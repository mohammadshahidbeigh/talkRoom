import {Request, Response} from "express";

export const errorHandler = (
  err: SyntaxError | Error,
  req: Request,
  res: Response
) => {
  // Handle JSON parsing errors
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON format in request body",
      error: err.message,
    });
  }

  // Handle other errors
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
};
