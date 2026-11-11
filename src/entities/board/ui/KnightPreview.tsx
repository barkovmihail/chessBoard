import React from "react";
import pieces from "./pieces.module.css";

export function KnightPreview({ set }: { set: string }) {
  if (set === "cburnett") return <span aria-hidden="true" className={pieces.knight + " " + pieces.white}
    style={{ width: 32, height: 32, backgroundSize: "contain" }} />;
  return <img alt="" width="32" height="32" src={"/pieces/" + set + "/wN.svg"} />;
}
