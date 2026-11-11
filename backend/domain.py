import chess
import chess.pgn


class GameError(Exception):
    def __init__(self, code: str, status: int):
        self.code = code
        self.status = status


def start_board(index):
    return chess.Board() if index is None else chess.Board.from_chess960_pos(index)


def display_fen(board):
    return f"{board.board_fen()} {'w' if board.turn else 'b'} - - 0 1"


def review960(index, history, result):
    board = start_board(index)
    fens = [display_fen(board)]
    for uci in history:
        board.push_uci(uci)
        fens.append(display_fen(board))
    record = chess.pgn.Game.from_board(board)
    record.headers["Variant"] = "Chess960"
    record.headers["Result"] = result
    return {"fens": fens, "pgn": str(record), "uci": history}


def replay(history, index=None):
    board = start_board(index)
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


def snapshot(game_id, history, index=None):
    board, notation = replay(history, index)
    outcome = board.outcome()
    return {
        "id": game_id, "last_uci": history[-1] if history else None, "version": len(history), "moves": notation,
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
