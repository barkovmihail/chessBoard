import chess
from sqlalchemy import select
from sqlalchemy.dialects.sqlite import insert

from .db import study_chapters
from .domain import GameError


class Studies:
    def __init__(self, engine):
        self.engine = engine

    def create(self, chapter_id, name, side, lines):
        if not name.strip():
            raise GameError("empty_title", 422)
        normalized = []
        for index, line in enumerate(lines, 1):
            board = chess.Board()
            steps = []
            for ply, (notation, comment) in enumerate(line, 1):
                try:
                    move = board.parse_san(notation.strip())
                    if move not in board.legal_moves or board.is_game_over():
                        raise ValueError()
                except ValueError as exc:
                    raise GameError(f"invalid_move/{index}/{ply}", 422) from exc
                steps.append([board.san(move), comment.strip()])
                board.push(move)
            if side == "b" and len(steps) < 2:
                raise GameError("missing_black_move", 422)
            normalized.append(steps)
        chapter = dict(id=chapter_id, name=name.strip(), side=side, lines=normalized)
        with self.engine.begin() as db:
            result = db.execute(insert(study_chapters).values(**chapter).on_conflict_do_nothing())
            if not result.rowcount:
                saved = db.execute(select(study_chapters).where(study_chapters.c.id == chapter_id)).mappings().one()
                if saved != chapter:
                    raise GameError("chapter_conflict", 409)
        return chapter

    def get(self, chapter_id):
        with self.engine.connect() as db:
            row = db.execute(select(study_chapters).where(study_chapters.c.id == chapter_id)).mappings().first()
        if row is None:
            raise GameError("chapter_missing", 404)
        return dict(row)
