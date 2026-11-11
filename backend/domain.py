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


def claim_options(board):
    def reason():
        if board.is_fifty_moves():
            return "fifty_moves"
        if board.is_repetition(3):
            return "threefold_repetition"

    current = reason()
    if current:
        return {"claim": current}
    options = {}
    if board.halfmove_clock < 99 and not board.can_claim_threefold_repetition():
        return options
    for move in list(board.legal_moves):
        board.push(move)
        candidate = reason()
        board.pop()
        if candidate:
            options["claim:" + move.uci()] = candidate
    return options


def snapshot(game_id, history):
    board, notation = replay(history)
    outcome = board.outcome()
    return {
        "id": game_id, "version": len(history), "moves": notation,
        "turn": "white" if board.turn else "black",
        "result": outcome.result() if outcome else None,
        "reason": outcome.termination.name.lower() if outcome else None,
        "claims": {} if outcome else claim_options(board),
        "legal": [] if outcome else [move.uci() for move in board.legal_moves],
        "position": [
            {"square": chess.square_name(square), "type": chess.piece_name(piece.piece_type),
             "color": "white" if piece.color else "black"}
            for square, piece in board.piece_map().items()
        ],
    }
