import { ZodError, ZodTypeAny } from "zod";

export class ZodInterface<T extends ZodTypeAny> {
  private config;
  constructor(config: T) {
    this.config = config;
  }
  public parse(object: unknown): ReturnType<T["parse"]> {
    try {
      const val = this.config.parse(object);
      return val;
    } catch (error) {
      if (error instanceof ZodError) {
        throw new Error(`Validation failed: ${error.message}`);
      } else {
        throw new Error("Unexpected error during validation");
      }
    }
  }
}
