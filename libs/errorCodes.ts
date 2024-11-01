type DetailedErrorT = {
  error: string;
  status: number;
};
type ServerErrorDetailT = {
  description: string;
  code: number;
};

// Type | Element | Specific Error
export const ClientErrors = {
  ClientEmailNotValid: {
    code: "000",
    message: "Email Not Valid",
  },
  ClientPasswordNotValid: {
    code: "010",
    message: "Passowrd Not Valid",
  },
  ClientPasswordTooShort: {
    code: "011",
    message: "Passowrd Too Short",
  },
  ClientPasswordMustIncludeUpper: {
    code: "012",
    message: "Passowrd must include at least one upper case letter",
  },
  ClientPasswordMustIncludeSpecial: {
    code: "013",
    message: "Passowrd must include at least one special character",
  },
};

export const ServerErrors = {
  Generic: {
    error: "Generic Server Error",
    status: 500,
  },
  Conflict: {
    error: "Conflict",
    status: 409,
  },
  NotAllowed: {
    error: "Not Allowed",
    status: 405,
  },
  NotFound: {
    error: "Not Found",
    status: 404,
  },
  Forbidden: {
    error: "Forbidden",
    status: 403,
  },
  Unauthorized: {
    error: "Unauthorized",
    status: 401,
  },
  BadRequest: {
    error: "Bad Request",
    status: 400,
  },
};
export const ServerErrorsDetails = {
  BadRequest: {
    Email: {
      description: "Email not provided",
      code: 1,
    },
    Password: {
      description: "Password not provided",
      code: 2,
    },
    EmailOrPassword: {
      description: "Email or password not provided",
      code: 3,
    },
  },
};
export function responseFromError(from: DetailedErrorT, additionalError?: ServerErrorDetailT) {
  return new Response(
    JSON.stringify({
      error: from.error,
      code: additionalError?.code || 0,
    }),
    {
      status: from.status,
    },
  );
}
