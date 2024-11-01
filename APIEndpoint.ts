import { APIEvent } from "@solidjs/start/server";
import { getCookie } from "vinxi/http";
import { ZodTypeAny } from "zod";
import { responseFromError, ServerErrors } from "./libs/errorCodes";
import { ZodInterface } from "./libs/classes/ZodInterface";
import jwt from "jsonwebtoken";

type ParsedType<T, U> = {
  body: T extends "JSON"
    ? U extends ZodTypeAny
      ? ReturnType<U["parse"]>
      : Record<string, unknown>
    : FormData;
  params: Record<string, string | undefined>;
  url: URL;
  searchParams: URLSearchParams;
  headers: Record<string, string | undefined>;
};
type JWType = {
  email: string;
  hashedEmail: string;
  role: number;
  username: string;
};
type DataType = JWType & { personality: number | undefined };

type HTTPMethodType = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export function getUserData(token: string | undefined) {
  "use server";
  if (!token) {
    return { username: "", hashedEmail: "", email: "", role: -1 };
  }
  let data = {} as JWType;
  try {
    data = jwt.verify(token, process.env.JWT_SECRET!.toString()) as JWType;
  } catch (e) {
    console.error("Invalid JWT provided ", e);
    return data;
  }
  return data;
}

export function checkUserPermission(
  token: string | undefined,
  reqRole: number | undefined = 0
): Response | null {
  "use server";
  if (!token) {
    return responseFromError(ServerErrors.Forbidden);
  }
  let role = 0;
  try {
    role = (jwt.verify(token, process.env.JWT_SECRET!.toString()) as JWType)
      .role;
  } catch (e) {
    console.error("Invalid JWT provided ", e);
    return responseFromError(ServerErrors.BadRequest);
  }
  if (reqRole && reqRole > role)
    return responseFromError(ServerErrors.Forbidden);

  return null;
}

export default class APIEndpoint<
  S extends number = -1,
  T extends "FormData" | "JSON" = "JSON",
  U extends ZodTypeAny | null = null
> {
  private defResp = async () => new Response(null, ServerErrors.NotAllowed);
  private params;
  private async _handleRequest(
    method: HTTPMethodType,
    callback: (_parsed: ParsedType<T, U>, _data: DataType) => Promise<Response>,
    event: APIEvent
  ): Promise<Response> {
    const eParams = this.params?.[method] || {
      role: -1,
      bodyType: "JSON",
      zodConfig: null,
    };
    // Security Checks
    const resp =
      eParams.role &&
      eParams.role >= 0 &&
      checkUserPermission(getCookie("token"), eParams.role);
    if (resp) return resp;
    // End Security Checks
    // Generic Try/Catch
    try {
      let body = {} as T extends "JSON"
        ? U extends ZodTypeAny
          ? ReturnType<U["parse"]>
          : Record<string, unknown>
        : FormData;
      if (["POST", "PUT", "PATCH"].includes(method)) {
        if (eParams.bodyType === "FormData") {
          body = (await event.request.formData()) as T extends "JSON"
            ? never
            : FormData;
        } else {
          try {
            body = (await event.request.json()) as T extends "JSON"
              ? U extends ZodTypeAny
                ? never
                : Record<string, unknown>
              : never;
            if (eParams.zodConfig) {
              const zod = new ZodInterface(eParams.zodConfig);
              try {
                body = zod.parse(body) as T extends "JSON"
                  ? U extends ZodTypeAny
                    ? ReturnType<U["parse"]>
                    : never
                  : never;
              } catch (e) {
                console.error("Zod Validation Failed", e);
                throw new Error("BadRequest");
              }
            }
          } catch (e) {
            console.warn("Body not found in POST request", e);
          }
        }
      }
      const url = new URL(event.request.url);
      const searchParams = url.searchParams;
      const params = {} as Record<string, string | undefined>;
      Object.keys(event.params).forEach(
        (el) => (params[el] = decodeURI(event.params[el]))
      );
      const headers = {} as Record<string, string | undefined>;
      event.request.headers.forEach((value, key) => (headers[key] = value));
      const customEvent: ParsedType<T, U> = {
        body,
        params,
        url,
        searchParams,
        headers,
      }; // Update with additional stuff if needed
      const data = getUserData(getCookie("token"));
      // In case custom logic is defined use it, otherwise just return a 405
      const persCookie = getCookie("personality");
      return callback?.(customEvent, {
        ...data,
        personality: persCookie ? parseInt(persCookie) : undefined,
      });
    } catch (e) {
      console.error(`${method} request error:`, e);
      return responseFromError(ServerErrors.Generic);
    }
  }

  private async getReq(event: APIEvent) {
    return this._handleRequest("GET", this.defResp, event);
  }
  private async postReq(event: APIEvent) {
    return this._handleRequest("POST", this.defResp, event);
  }
  private async putReq(event: APIEvent) {
    return this._handleRequest("PUT", this.defResp, event);
  }
  private async patchReq(event: APIEvent) {
    return this._handleRequest("PATCH", this.defResp, event);
  }
  private async deleteReq(event: APIEvent) {
    return this._handleRequest("DELETE", this.defResp, event);
  }
  constructor(
    params:
      | Partial<
          Record<
            HTTPMethodType,
            {
              role?: S;
              bodyType?: T;
              zodConfig?: T extends "JSON" ? U : never;
            }
          >
        >
      | undefined
  ) {
    this.params = params;
    // Bind the methods to the instance
    this.getReq = this.getReq.bind(this);
    this.postReq = this.postReq.bind(this);
    this.putReq = this.putReq.bind(this);
    this.patchReq = this.patchReq.bind(this);
    this.deleteReq = this.deleteReq.bind(this);
  }
  get GET() {
    /*
      WHY ts-ignore? I need to return the wrapper function that I'm correctly setting in the setter (no other cool way).
      This R thinks that I'm setting the function to the type I've passed rather than what I actually set.
      No other way than ignoring typescript on this istruction is possible if I want to keep class.GET and GET = new callback (channging just the callback, not all the GET function)
    */
    // @ts-expect-error up ^
    return this.getReq;
  }
  set GET(
    fn: (_parsed: ParsedType<T, U>, _data: DataType) => Promise<Response>
  ) {
    this.getReq = (event) => this._handleRequest("GET", fn, event);
  }
  get POST() {
    // @ts-expect-error up ^
    return this.postReq;
  }
  set POST(
    fn: (_parsed: ParsedType<T, U>, _data: DataType) => Promise<Response>
  ) {
    this.postReq = (event) => this._handleRequest("POST", fn, event);
  }
  get PUT() {
    // @ts-expect-error up ^
    return this.putReq;
  }
  set PUT(
    fn: (_parsed: ParsedType<T, U>, _data: DataType) => Promise<Response>
  ) {
    this.putReq = (event) => this._handleRequest("PUT", fn, event);
  }
  get PATCH() {
    // @ts-expect-error up ^
    return this.patchReq;
  }
  set PATCH(
    fn: (_parsed: ParsedType<T, U>, _data: DataType) => Promise<Response>
  ) {
    this.patchReq = (event) => this._handleRequest("PATCH", fn, event);
  }
  get DELETE() {
    // @ts-expect-error up ^
    return this.deleteReq;
  }
  set DELETE(
    fn: (_parsed: ParsedType<T, U>, _data: DataType) => Promise<Response>
  ) {
    this.deleteReq = (event) => this._handleRequest("DELETE", fn, event);
  }
  get endpoints() {
    return {
      GET: this.GET,
      POST: this.POST,
      PUT: this.PUT,
      PATCH: this.PATCH,
      DELETE: this.DELETE,
    };
  }
}
