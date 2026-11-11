import chess


class GameError(Exception):
    def __init__(self, code: str, status: int):
        self.code = code
        self.status = status


def replay(history):
    board = chess.Board()
    notation = []
    for uci in history:
        move = chess.Move.from_uci(uci)
        notation.append(board.san(move))
        board.push(move)
    return board, notation


def snapshot(game_id, history):
    board, notation = replay(history)
    outcome = board.outcome()
    return {
        "id": game_id, "version": len(history), "moves": notation,
        "turn": "white" if board.turn else "black",
        "result": outcome.result() if outcome else None,
        "reason": outcome.termination.name.lower() if outcome else None,
        "legal": [] if outcome else [move.uci() for move in board.legal_moves],
        "position": [
            {"square": chess.square_name(square), "type": chess.piece_name(piece.piece_type),
             "color": "white" if piece.color else "black"}
            for square, piece in board.piece_map().items()
        ],
    }
