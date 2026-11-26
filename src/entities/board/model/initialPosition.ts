import { PieceColorType } from "./colorType";
import { PieceType } from "./pieceType";

import type { BoardPiece } from "./position";

export const initialPosition: readonly BoardPiece[] = [
  {
    color: PieceColorType.White,
    type: PieceType.Pawn,
    square: "a2",
  },
  {
    color: PieceColorType.White,
    type: PieceType.Pawn,
    square: "b2",
  },
  {
    color: PieceColorType.White,
    type: PieceType.Pawn,
    square: "c2",
  },
  {
    color: PieceColorType.White,
    type: PieceType.Pawn,
    square: "d2",
  },
  {
    color: PieceColorType.White,
    type: PieceType.Pawn,
    square: "e2",
  },
  {
    color: PieceColorType.White,
    type: PieceType.Pawn,
    square: "f2",
  },
  {
    color: PieceColorType.White,
    type: PieceType.Pawn,
    square: "g2",
  },
  {
    color: PieceColorType.White,
    type: PieceType.Pawn,
    square: "h2",
  },
  {
    color: PieceColorType.White,
    type: PieceType.Rook,
    square: "a1",
  },
  {
    color: PieceColorType.White,
    type: PieceType.Knight,
    square: "b1",
  },
  {
    color: PieceColorType.White,
    type: PieceType.Bishop,
    square: "c1",
  },
  {
    color: PieceColorType.White,
    type: PieceType.Queen,
    square: "d1",
  },
  {
    color: PieceColorType.White,
    type: PieceType.King,
    square: "e1",
  },
  {
    color: PieceColorType.White,
    type: PieceType.Bishop,
    square: "f1",
  },
  {
    color: PieceColorType.White,
    type: PieceType.Knight,
    square: "g1",
  },
  {
    color: PieceColorType.White,
    type: PieceType.Rook,
    square: "h1",
  },
  {
    color: PieceColorType.Black,
    type: PieceType.Pawn,
    square: "a7",
  },
  {
    color: PieceColorType.Black,
    type: PieceType.Pawn,
    square: "b7",
  },
  {
    color: PieceColorType.Black,
    type: PieceType.Pawn,
    square: "c7",
  },
  {
    color: PieceColorType.Black,
    type: PieceType.Pawn,
    square: "d7",
  },
  {
    color: PieceColorType.Black,
    type: PieceType.Pawn,
    square: "e7",
  },
  {
    color: PieceColorType.Black,
    type: PieceType.Pawn,
    square: "f7",
  },
  {
    color: PieceColorType.Black,
    type: PieceType.Pawn,
    square: "g7",
  },
  {
    color: PieceColorType.Black,
    type: PieceType.Pawn,
    square: "h7",
  },
  {
    color: PieceColorType.Black,
    type: PieceType.Rook,
    square: "a8",
  },
  {
    color: PieceColorType.Black,
    type: PieceType.Knight,
    square: "b8",
  },
  {
    color: PieceColorType.Black,
    type: PieceType.Bishop,
    square: "c8",
  },
  {
    color: PieceColorType.Black,
    type: PieceType.Queen,
    square: "d8",
  },
  {
    color: PieceColorType.Black,
    type: PieceType.King,
    square: "e8",
  },
  {
    color: PieceColorType.Black,
    type: PieceType.Bishop,
    square: "f8",
  },
  {
    color: PieceColorType.Black,
    type: PieceType.Knight,
    square: "g8",
  },
  {
    color: PieceColorType.Black,
    type: PieceType.Rook,
    square: "h8",
  },
];
