import type { PieceColorType } from "./colorType";
import type { PieceType } from "./pieceType";

export const files = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
export const ranks = [8, 7, 6, 5, 4, 3, 2, 1] as const;
export type Square = `${typeof files[number]}${typeof ranks[number]}`;

export interface BoardPiece {
  readonly color: PieceColorType;
  readonly type: PieceType;
  readonly square: Square;
}
