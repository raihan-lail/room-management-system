/// <reference types="multer" />

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export {};
