import hashlib
import secrets
from time import time

from sqlalchemy import delete, insert, select
from sqlalchemy.exc import IntegrityError

from .db import accounts, sessions
from .domain import GameError

SESSION_SECONDS = 30 * 86400


def digest(token):
    return hashlib.sha256(token.encode()).hexdigest()


def password_hash(password, salt):
    return hashlib.scrypt(password.encode(), salt=salt, n=32768, r=8, p=1, maxmem=64 * 1024 * 1024)


class Accounts:
    def __init__(self, engine):
        self.engine = engine

    def resolve(self, token):
        if not token:
            return None, None
        key = digest(token)
        with self.engine.connect() as db:
            if token.startswith("account."):
                row = db.execute(select(accounts.c.player, accounts.c.name).join(sessions)
                    .where(sessions.c.digest == key, sessions.c.expires > int(time()))).first()
                return tuple(row) if row else (None, None)
            # Registration retires the old guest cookie while retaining its game records.
            if db.scalar(select(accounts.c.player).where(accounts.c.player == key)):
                return None, None
            return key, None

    def register(self, name, password, player):
        salt = secrets.token_bytes(16)
        hashed = password_hash(password, salt)
        player = player or secrets.token_hex(32)
        with self.engine.begin() as db:
            try:
                db.execute(insert(accounts).values(player=player, name=name, salt=salt, password_hash=hashed))
            except IntegrityError as exc:
                raise GameError("account_exists", 409) from exc
            return self._session(db, player)

    def login(self, name, password):
        with self.engine.connect() as db:
            account = db.execute(select(accounts).where(accounts.c.name == name)).mappings().first()
        hashed = password_hash(password, account["salt"] if account else bytes(16))
        if not account or not secrets.compare_digest(hashed, account["password_hash"]):
            raise GameError("invalid_credentials", 401)
        with self.engine.begin() as db:
            return self._session(db, account["player"])

    def _session(self, db, player):
        token = "account." + secrets.token_urlsafe(32)
        db.execute(insert(sessions).values(player=player, digest=digest(token), expires=int(time()) + SESSION_SECONDS))
        return token

    def logout(self, token):
        if token:
            with self.engine.begin() as db:
                db.execute(delete(sessions).where(sessions.c.digest == digest(token)))
