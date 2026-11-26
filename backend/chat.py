from sqlalchemy import delete, func, select, update
from sqlalchemy.dialects.sqlite import insert

from .db import accounts, chat_blocks as blocks, chat_messages as messages, chat_reports as reports
from .domain import GameError


class Chat:
    def __init__(self, engine):
        self.engine = engine

    def feed(self, player):
        with self.engine.connect() as db:
            db.exec_driver_sql("BEGIN")
            prefs = db.execute(select(accounts.c.name, accounts.c.chat_muted, accounts.c.chat_moderator)
                               .where(accounts.c.player == player)).first()
            name, muted, moderator = prefs or (None, False, False)
            blocked = select(blocks.c.author).where(blocks.c.player == player)
            names = db.scalars(select(accounts.c.name).where(accounts.c.player.in_(blocked)).order_by(accounts.c.name)).all()
            reported = select(reports.c.message).where(reports.c.reporter == player)
            query = select(messages.c.seq, accounts.c.name, messages.c.body, messages.c.seq.in_(reported).label("reported")).join(accounts)
            rows = [] if muted else db.execute(query.where(messages.c.hidden.is_(False), messages.c.author.not_in(blocked))
                    .order_by(messages.c.seq.desc()).limit(50)).mappings().all()
            queue = []
            if moderator:
                queue = db.execute(select(messages.c.seq, accounts.c.name, messages.c.body, func.count().label("count"))
                    .select_from(reports).join(messages, reports.c.message == messages.c.seq).join(accounts, messages.c.author == accounts.c.player)
                    .where(reports.c.decision.is_(None)).group_by(messages.c.seq, accounts.c.name, messages.c.body)
                    .order_by(messages.c.seq).limit(50)).mappings().all()
            return dict(name=name, muted=muted, blocked=names, moderator=moderator,
                        messages=[dict(row) for row in reversed(rows)], queue=[dict(row) for row in queue])

    def send(self, player, token, body):
        body = body.strip()
        if not body:
            raise GameError("empty_message", 422)
        with self.engine.begin() as db:
            db.exec_driver_sql("BEGIN IMMEDIATE")
            if db.scalar(select(accounts.c.chat_muted).where(accounts.c.player == player)):
                raise GameError("chat_muted", 409)
            entry = insert(messages).values(author=player, token=token, body=body)
            if not db.execute(entry.on_conflict_do_nothing()).rowcount:
                old = db.scalar(select(messages.c.body).where(messages.c.author == player, messages.c.token == token))
                if old != body:
                    raise GameError("command_conflict", 409)

    def mute(self, player, enabled):
        with self.engine.begin() as db:
            db.execute(update(accounts).where(accounts.c.player == player).values(chat_muted=enabled))

    def block(self, player, name, enabled):
        with self.engine.begin() as db:
            author = db.scalar(select(accounts.c.player).where(accounts.c.name == name))
            if not author or author == player:
                raise GameError("invalid_author", 422)
            if enabled:
                db.execute(insert(blocks).values(player=player, author=author).on_conflict_do_nothing())
            else:
                db.execute(delete(blocks).where(blocks.c.player == player, blocks.c.author == author))

    def report(self, player, seq):
        with self.engine.begin() as db:
            db.exec_driver_sql("BEGIN IMMEDIATE")
            author = db.scalar(select(messages.c.author).where(messages.c.seq == seq, messages.c.hidden.is_(False)))
            if not author or author == player:
                raise GameError("message_unavailable", 404)
            db.execute(insert(reports).values(message=seq, reporter=player).on_conflict_do_nothing())

    def review(self, player, seq, decision):
        with self.engine.begin() as db:
            db.exec_driver_sql("BEGIN IMMEDIATE")
            if not db.scalar(select(accounts.c.chat_moderator).where(accounts.c.player == player)):
                raise GameError("moderator_required", 403)
            result = db.execute(update(reports).where(reports.c.message == seq, reports.c.decision.is_(None))
                                .values(decision=decision, reviewer=player))
            if result.rowcount and decision == "hide":
                db.execute(update(messages).where(messages.c.seq == seq).values(hidden=True))
