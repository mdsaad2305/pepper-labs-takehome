import type { ErrorRequestHandler, RequestHandler } from "express";
import { HttpError } from "../errors.js";

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "Not found" });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  if (
    err instanceof SyntaxError &&
    (err as SyntaxError & { type?: string }).type === "entity.parse.failed"
  ) {
    res.status(400).json({ error: "Invalid JSON request body" });
    return;
  }

  console.error(err);
  res.status(500).json({ error: "Internal server error" });
};
