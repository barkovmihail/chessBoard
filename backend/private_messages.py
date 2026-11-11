from time import time_ns

from sqlalchemy import or_, select

from .db import accounts, private_messages as messages
from .domain import GameError


class PrivateMessages:
    def __init__(self, engine):
        self.engine = engine

    def send(self, player, name, token, body):
        body = body.strip()
        if not body:
            raise GameError("empty_message", 422)
        with self.engine.begin() as db:
            db.exec_driver_sql("BEGIN IMMEDIATE")
            recipient = db.scalar(select(accounts.c.player).where(accounts.c.name == name.strip()))
            if not recipient or recipient == player:
                raise GameError("invalid_recipient", 422)
            previous = db.execute(select(messages.c.recipient, messages.c.body)
                                  .where(messages.c.sender == player, messages.c.token == token)).first()
            if previous:
                if previous.recipient != recipient or previous.body != body:
                    raise GameError("message_conflict", 409)
                return
            db.execute(messages.insert().values(sender=player, recipient=recipient, token=token,
                                                body=body, created=time_ns() // 1_000_000))

    def page(self, player, before):
        sender = accounts.alias("sender")
        recipient = accounts.alias("recipient")
        query = (select(messages.c.seq, sender.c.name.label("sender"), recipient.c.name.label("recipient"),
                        messages.c.body, messages.c.created, (messages.c.sender == player).label("outgoing"))
                 .join(sender, messages.c.sender == sender.c.player)
                 .join(recipient, messages.c.recipient == recipient.c.player)
                 .where(or_(messages.c.sender == player, messages.c.recipient == player)))
        if before is not None:
            query = query.where(messages.c.seq < before)
        with self.engine.connect() as db:
            rows = db.execute(query.order_by(messages.c.seq.desc()).limit(21)).mappings().all()
        return {"items": [dict(row) for row in rows[:20]], "before": rows[19].seq if len(rows) > 20 else None}
