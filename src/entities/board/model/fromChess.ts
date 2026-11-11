import type { Chess } from "chess.js";
import { PieceColorType } from "./colorType";
import { PieceType } from "./pieceType";
import type { BoardPiece } from "./position";

const types = { p: PieceType.Pawn, n: PieceType.Knight, b: PieceType.Bishop,
  r: PieceType.Rook, q: PieceType.Queen, k: PieceType.King };

export function boardPosition(board: Chess): BoardPiece[] {
  return board.board().flat().flatMap(piece => piece ? [{
    type: types[piece.type], square: piece.square, color: piece.color === "w" ? PieceColorType.White : PieceColorType.Black,
  }] : []);
}
