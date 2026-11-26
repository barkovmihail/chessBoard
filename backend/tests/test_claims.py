from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase

import chess

from backend.db import open_database
from backend.domain import GameError, claim_options
from backend.service import Games


class DrawClaimsTest(TestCase):
    def test_fifty_moves(self):
        board = chess.Board("7k/8/8/8/8/8/P7/R5K1 w - - 99 50")
        options = claim_options(board)
        self.assertEqual(options["claim:a1b1"], "fifty_moves")
        self.assertNotIn("claim:a2a3", options)
        self.assertNotIn("claim", options)
        board.push_uci("a1b1")
        self.assertEqual(claim_options(board), {"claim": "fifty_moves"})

    def test_repetition_claims(self):
        for intended in (True, False):
            with self.subTest(intended=intended), TemporaryDirectory() as directory:
                engine = open_database(Path(directory) / "game.db")
                games = Games(engine, lambda: 1000)
                game = games.create("w", True, (5, 3))
                gid = game["id"]
                games.join(gid, "b")
                cycle = ["g1f3", "g8f6", "f3g1", "f6g8"] * 2
                for i, move in enumerate(cycle[:7 if intended else 8]):
                    game = games.apply(gid, "w" if i % 2 == 0 else "b", move, i, str(i))
                player = "b" if intended else "w"
                version = game["version"]
                claim = "claim:f6g8" if intended else "claim"
                for side, command, code in [(player, "claim:a2a3", 422),
                                            ("w" if intended else "b", claim, 403)]:
                    with self.assertRaises(GameError) as error:
                        games.apply(gid, side, command, version, "attempt")
                    self.assertEqual(error.exception.status, code)
                result = games.apply(gid, player, claim, version, "draw")
                self.assertEqual(result["reason"], "threefold_repetition")
                self.assertEqual(result["moves"], game["moves"])
                self.assertIsNone(result["clock"]["deadline_ms"])
                self.assertEqual(result, games.apply(gid, player, claim, version, "draw"))
                engine.dispose()
