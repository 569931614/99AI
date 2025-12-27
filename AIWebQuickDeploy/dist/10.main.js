"use strict";
exports.id = 10;
exports.ids = [10];
exports.modules = {

/***/ 4493:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   loadRestJsonErrorCode: () => (/* binding */ loadRestJsonErrorCode),
/* harmony export */   parseJsonBody: () => (/* binding */ parseJsonBody),
/* harmony export */   parseJsonErrorBody: () => (/* binding */ parseJsonErrorBody)
/* harmony export */ });
/* harmony import */ var _common__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3156);

const parseJsonBody = (streamBody, context) => (0,_common__WEBPACK_IMPORTED_MODULE_0__.collectBodyString)(streamBody, context).then((encoded) => {
    if (encoded.length) {
        try {
            return JSON.parse(encoded);
        }
        catch (e) {
            if (e?.name === "SyntaxError") {
                Object.defineProperty(e, "$responseBodyText", {
                    value: encoded,
                });
            }
            throw e;
        }
    }
    return {};
});
const parseJsonErrorBody = async (errorBody, context) => {
    const value = await parseJsonBody(errorBody, context);
    value.message = value.message ?? value.Message;
    return value;
};
const loadRestJsonErrorCode = (output, data) => {
    const findKey = (object, key) => Object.keys(object).find((k) => k.toLowerCase() === key.toLowerCase());
    const sanitizeErrorCode = (rawValue) => {
        let cleanValue = rawValue;
        if (typeof cleanValue === "number") {
            cleanValue = cleanValue.toString();
        }
        if (cleanValue.indexOf(",") >= 0) {
            cleanValue = cleanValue.split(",")[0];
        }
        if (cleanValue.indexOf(":") >= 0) {
            cleanValue = cleanValue.split(":")[0];
        }
        if (cleanValue.indexOf("#") >= 0) {
            cleanValue = cleanValue.split("#")[1];
        }
        return cleanValue;
    };
    const headerKey = findKey(output.headers, "x-amzn-errortype");
    if (headerKey !== undefined) {
        return sanitizeErrorCode(output.headers[headerKey]);
    }
    if (data && typeof data === "object") {
        const codeKey = findKey(data, "code");
        if (codeKey && data[codeKey] !== undefined) {
            return sanitizeErrorCode(data[codeKey]);
        }
        if (data["__type"] !== undefined) {
            return sanitizeErrorCode(data["__type"]);
        }
    }
};


/***/ }),

/***/ 4516:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   SSOOIDC: () => (/* binding */ SSOOIDC)
/* harmony export */ });
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(3468);
/* harmony import */ var _commands_CreateTokenCommand__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(4517);
/* harmony import */ var _SSOOIDCClient__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(4506);



const commands = {
    CreateTokenCommand: _commands_CreateTokenCommand__WEBPACK_IMPORTED_MODULE_0__.CreateTokenCommand,
};
class SSOOIDC extends _SSOOIDCClient__WEBPACK_IMPORTED_MODULE_1__.SSOOIDCClient {
}
(0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_2__.createAggregatedClient)(commands, SSOOIDC);


/***/ }),

/***/ 4506:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   SSOOIDCClient: () => (/* binding */ SSOOIDCClient),
/* harmony export */   __Client: () => (/* reexport safe */ _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_0__.Client)
/* harmony export */ });
/* harmony import */ var _aws_sdk_middleware_host_header__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(3011);
/* harmony import */ var _aws_sdk_middleware_logger__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(3314);
/* harmony import */ var _aws_sdk_middleware_recursion_detection__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(3315);
/* harmony import */ var _aws_sdk_middleware_user_agent__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(3286);
/* harmony import */ var _aws_sdk_middleware_user_agent__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(3306);
/* harmony import */ var _smithy_config_resolver__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(3297);
/* harmony import */ var _smithy_core__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(3319);
/* harmony import */ var _smithy_core__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(3322);
/* harmony import */ var _smithy_core__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(3323);
/* harmony import */ var _smithy_middleware_content_length__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(3012);
/* harmony import */ var _smithy_middleware_endpoint__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(3300);
/* harmony import */ var _smithy_middleware_retry__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(3257);
/* harmony import */ var _smithy_middleware_retry__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(3311);
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3295);
/* harmony import */ var _auth_httpAuthSchemeProvider__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(4507);
/* harmony import */ var _endpoint_EndpointParameters__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(4508);
/* harmony import */ var _runtimeConfig__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(4509);
/* harmony import */ var _runtimeExtensions__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(4514);















class SSOOIDCClient extends _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_0__.Client {
    config;
    constructor(...[configuration]) {
        const _config_0 = (0,_runtimeConfig__WEBPACK_IMPORTED_MODULE_1__.getRuntimeConfig)(configuration || {});
        super(_config_0);
        this.initConfig = _config_0;
        const _config_1 = (0,_endpoint_EndpointParameters__WEBPACK_IMPORTED_MODULE_2__.resolveClientEndpointParameters)(_config_0);
        const _config_2 = (0,_aws_sdk_middleware_user_agent__WEBPACK_IMPORTED_MODULE_3__.resolveUserAgentConfig)(_config_1);
        const _config_3 = (0,_smithy_middleware_retry__WEBPACK_IMPORTED_MODULE_4__.resolveRetryConfig)(_config_2);
        const _config_4 = (0,_smithy_config_resolver__WEBPACK_IMPORTED_MODULE_5__.resolveRegionConfig)(_config_3);
        const _config_5 = (0,_aws_sdk_middleware_host_header__WEBPACK_IMPORTED_MODULE_6__.resolveHostHeaderConfig)(_config_4);
        const _config_6 = (0,_smithy_middleware_endpoint__WEBPACK_IMPORTED_MODULE_7__.resolveEndpointConfig)(_config_5);
        const _config_7 = (0,_auth_httpAuthSchemeProvider__WEBPACK_IMPORTED_MODULE_8__.resolveHttpAuthSchemeConfig)(_config_6);
        const _config_8 = (0,_runtimeExtensions__WEBPACK_IMPORTED_MODULE_9__.resolveRuntimeExtensions)(_config_7, configuration?.extensions || []);
        this.config = _config_8;
        this.middlewareStack.use((0,_aws_sdk_middleware_user_agent__WEBPACK_IMPORTED_MODULE_10__.getUserAgentPlugin)(this.config));
        this.middlewareStack.use((0,_smithy_middleware_retry__WEBPACK_IMPORTED_MODULE_11__.getRetryPlugin)(this.config));
        this.middlewareStack.use((0,_smithy_middleware_content_length__WEBPACK_IMPORTED_MODULE_12__.getContentLengthPlugin)(this.config));
        this.middlewareStack.use((0,_aws_sdk_middleware_host_header__WEBPACK_IMPORTED_MODULE_6__.getHostHeaderPlugin)(this.config));
        this.middlewareStack.use((0,_aws_sdk_middleware_logger__WEBPACK_IMPORTED_MODULE_13__.getLoggerPlugin)(this.config));
        this.middlewareStack.use((0,_aws_sdk_middleware_recursion_detection__WEBPACK_IMPORTED_MODULE_14__.getRecursionDetectionPlugin)(this.config));
        this.middlewareStack.use((0,_smithy_core__WEBPACK_IMPORTED_MODULE_15__.getHttpAuthSchemeEndpointRuleSetPlugin)(this.config, {
            httpAuthSchemeParametersProvider: _auth_httpAuthSchemeProvider__WEBPACK_IMPORTED_MODULE_8__.defaultSSOOIDCHttpAuthSchemeParametersProvider,
            identityProviderConfigProvider: async (config) => new _smithy_core__WEBPACK_IMPORTED_MODULE_16__.DefaultIdentityProviderConfig({
                "aws.auth#sigv4": config.credentials,
            }),
        }));
        this.middlewareStack.use((0,_smithy_core__WEBPACK_IMPORTED_MODULE_17__.getHttpSigningPlugin)(this.config));
    }
    destroy() {
        super.destroy();
    }
}


/***/ }),

/***/ 4515:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getHttpAuthExtensionConfiguration: () => (/* binding */ getHttpAuthExtensionConfiguration),
/* harmony export */   resolveHttpAuthRuntimeConfig: () => (/* binding */ resolveHttpAuthRuntimeConfig)
/* harmony export */ });
const getHttpAuthExtensionConfiguration = (runtimeConfig) => {
    const _httpAuthSchemes = runtimeConfig.httpAuthSchemes;
    let _httpAuthSchemeProvider = runtimeConfig.httpAuthSchemeProvider;
    let _credentials = runtimeConfig.credentials;
    return {
        setHttpAuthScheme(httpAuthScheme) {
            const index = _httpAuthSchemes.findIndex((scheme) => scheme.schemeId === httpAuthScheme.schemeId);
            if (index === -1) {
                _httpAuthSchemes.push(httpAuthScheme);
            }
            else {
                _httpAuthSchemes.splice(index, 1, httpAuthScheme);
            }
        },
        httpAuthSchemes() {
            return _httpAuthSchemes;
        },
        setHttpAuthSchemeProvider(httpAuthSchemeProvider) {
            _httpAuthSchemeProvider = httpAuthSchemeProvider;
        },
        httpAuthSchemeProvider() {
            return _httpAuthSchemeProvider;
        },
        setCredentials(credentials) {
            _credentials = credentials;
        },
        credentials() {
            return _credentials;
        },
    };
};
const resolveHttpAuthRuntimeConfig = (config) => {
    return {
        httpAuthSchemes: config.httpAuthSchemes(),
        httpAuthSchemeProvider: config.httpAuthSchemeProvider(),
        credentials: config.credentials(),
    };
};


/***/ }),

/***/ 4507:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   defaultSSOOIDCHttpAuthSchemeParametersProvider: () => (/* binding */ defaultSSOOIDCHttpAuthSchemeParametersProvider),
/* harmony export */   defaultSSOOIDCHttpAuthSchemeProvider: () => (/* binding */ defaultSSOOIDCHttpAuthSchemeProvider),
/* harmony export */   resolveHttpAuthSchemeConfig: () => (/* binding */ resolveHttpAuthSchemeConfig)
/* harmony export */ });
/* harmony import */ var _aws_sdk_core__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(3120);
/* harmony import */ var _smithy_util_middleware__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3067);
/* harmony import */ var _smithy_util_middleware__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3094);


const defaultSSOOIDCHttpAuthSchemeParametersProvider = async (config, context, input) => {
    return {
        operation: (0,_smithy_util_middleware__WEBPACK_IMPORTED_MODULE_0__.getSmithyContext)(context).operation,
        region: (await (0,_smithy_util_middleware__WEBPACK_IMPORTED_MODULE_1__.normalizeProvider)(config.region)()) ||
            (() => {
                throw new Error("expected `region` to be configured for `aws.auth#sigv4`");
            })(),
    };
};
function createAwsAuthSigv4HttpAuthOption(authParameters) {
    return {
        schemeId: "aws.auth#sigv4",
        signingProperties: {
            name: "sso-oauth",
            region: authParameters.region,
        },
        propertiesExtractor: (config, context) => ({
            signingProperties: {
                config,
                context,
            },
        }),
    };
}
function createSmithyApiNoAuthHttpAuthOption(authParameters) {
    return {
        schemeId: "smithy.api#noAuth",
    };
}
const defaultSSOOIDCHttpAuthSchemeProvider = (authParameters) => {
    const options = [];
    switch (authParameters.operation) {
        case "CreateToken": {
            options.push(createSmithyApiNoAuthHttpAuthOption(authParameters));
            break;
        }
        default: {
            options.push(createAwsAuthSigv4HttpAuthOption(authParameters));
        }
    }
    return options;
};
const resolveHttpAuthSchemeConfig = (config) => {
    const config_0 = (0,_aws_sdk_core__WEBPACK_IMPORTED_MODULE_2__.resolveAwsSdkSigV4Config)(config);
    return Object.assign(config_0, {
        authSchemePreference: (0,_smithy_util_middleware__WEBPACK_IMPORTED_MODULE_1__.normalizeProvider)(config.authSchemePreference ?? []),
    });
};


/***/ }),

/***/ 4517:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   $Command: () => (/* reexport safe */ _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_0__.Command),
/* harmony export */   CreateTokenCommand: () => (/* binding */ CreateTokenCommand)
/* harmony export */ });
/* harmony import */ var _smithy_middleware_endpoint__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(3187);
/* harmony import */ var _smithy_middleware_serde__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(3183);
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3171);
/* harmony import */ var _endpoint_EndpointParameters__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(4508);
/* harmony import */ var _models_models_0__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(4518);
/* harmony import */ var _protocols_Aws_restJson1__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(4520);







class CreateTokenCommand extends _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_0__.Command
    .classBuilder()
    .ep(_endpoint_EndpointParameters__WEBPACK_IMPORTED_MODULE_1__.commonParams)
    .m(function (Command, cs, config, o) {
    return [
        (0,_smithy_middleware_serde__WEBPACK_IMPORTED_MODULE_2__.getSerdePlugin)(config, this.serialize, this.deserialize),
        (0,_smithy_middleware_endpoint__WEBPACK_IMPORTED_MODULE_3__.getEndpointPlugin)(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("AWSSSOOIDCService", "CreateToken", {})
    .n("SSOOIDCClient", "CreateTokenCommand")
    .f(_models_models_0__WEBPACK_IMPORTED_MODULE_4__.CreateTokenRequestFilterSensitiveLog, _models_models_0__WEBPACK_IMPORTED_MODULE_4__.CreateTokenResponseFilterSensitiveLog)
    .ser(_protocols_Aws_restJson1__WEBPACK_IMPORTED_MODULE_5__.se_CreateTokenCommand)
    .de(_protocols_Aws_restJson1__WEBPACK_IMPORTED_MODULE_5__.de_CreateTokenCommand)
    .build() {
}


/***/ }),

/***/ 4521:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   $Command: () => (/* reexport safe */ _CreateTokenCommand__WEBPACK_IMPORTED_MODULE_0__.$Command),
/* harmony export */   CreateTokenCommand: () => (/* reexport safe */ _CreateTokenCommand__WEBPACK_IMPORTED_MODULE_0__.CreateTokenCommand)
/* harmony export */ });
/* harmony import */ var _CreateTokenCommand__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(4517);



/***/ }),

/***/ 4508:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   commonParams: () => (/* binding */ commonParams),
/* harmony export */   resolveClientEndpointParameters: () => (/* binding */ resolveClientEndpointParameters)
/* harmony export */ });
const resolveClientEndpointParameters = (options) => {
    return Object.assign(options, {
        useDualstackEndpoint: options.useDualstackEndpoint ?? false,
        useFipsEndpoint: options.useFipsEndpoint ?? false,
        defaultSigningName: "sso-oauth",
    });
};
const commonParams = {
    UseFIPS: { type: "builtInParams", name: "useFipsEndpoint" },
    Endpoint: { type: "builtInParams", name: "endpoint" },
    Region: { type: "builtInParams", name: "region" },
    UseDualStack: { type: "builtInParams", name: "useDualstackEndpoint" },
};


/***/ }),

/***/ 4512:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   defaultEndpointResolver: () => (/* binding */ defaultEndpointResolver)
/* harmony export */ });
/* harmony import */ var _aws_sdk_util_endpoints__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3015);
/* harmony import */ var _smithy_util_endpoints__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3066);
/* harmony import */ var _smithy_util_endpoints__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(3029);
/* harmony import */ var _smithy_util_endpoints__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(3024);
/* harmony import */ var _ruleset__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(4513);



const cache = new _smithy_util_endpoints__WEBPACK_IMPORTED_MODULE_1__.EndpointCache({
    size: 50,
    params: ["Endpoint", "Region", "UseDualStack", "UseFIPS"],
});
const defaultEndpointResolver = (endpointParams, context = {}) => {
    return cache.get(endpointParams, () => (0,_smithy_util_endpoints__WEBPACK_IMPORTED_MODULE_2__.resolveEndpoint)(_ruleset__WEBPACK_IMPORTED_MODULE_3__.ruleSet, {
        endpointParams: endpointParams,
        logger: context.logger,
    }));
};
_smithy_util_endpoints__WEBPACK_IMPORTED_MODULE_4__.customEndpointFunctions.aws = _aws_sdk_util_endpoints__WEBPACK_IMPORTED_MODULE_0__.awsEndpointFunctions;


/***/ }),

/***/ 4513:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ruleSet: () => (/* binding */ ruleSet)
/* harmony export */ });
const u = "required", v = "fn", w = "argv", x = "ref";
const a = true, b = "isSet", c = "booleanEquals", d = "error", e = "endpoint", f = "tree", g = "PartitionResult", h = "getAttr", i = { [u]: false, "type": "String" }, j = { [u]: true, "default": false, "type": "Boolean" }, k = { [x]: "Endpoint" }, l = { [v]: c, [w]: [{ [x]: "UseFIPS" }, true] }, m = { [v]: c, [w]: [{ [x]: "UseDualStack" }, true] }, n = {}, o = { [v]: h, [w]: [{ [x]: g }, "supportsFIPS"] }, p = { [x]: g }, q = { [v]: c, [w]: [true, { [v]: h, [w]: [p, "supportsDualStack"] }] }, r = [l], s = [m], t = [{ [x]: "Region" }];
const _data = { version: "1.0", parameters: { Region: i, UseDualStack: j, UseFIPS: j, Endpoint: i }, rules: [{ conditions: [{ [v]: b, [w]: [k] }], rules: [{ conditions: r, error: "Invalid Configuration: FIPS and custom endpoint are not supported", type: d }, { conditions: s, error: "Invalid Configuration: Dualstack and custom endpoint are not supported", type: d }, { endpoint: { url: k, properties: n, headers: n }, type: e }], type: f }, { conditions: [{ [v]: b, [w]: t }], rules: [{ conditions: [{ [v]: "aws.partition", [w]: t, assign: g }], rules: [{ conditions: [l, m], rules: [{ conditions: [{ [v]: c, [w]: [a, o] }, q], rules: [{ endpoint: { url: "https://oidc-fips.{Region}.{PartitionResult#dualStackDnsSuffix}", properties: n, headers: n }, type: e }], type: f }, { error: "FIPS and DualStack are enabled, but this partition does not support one or both", type: d }], type: f }, { conditions: r, rules: [{ conditions: [{ [v]: c, [w]: [o, a] }], rules: [{ conditions: [{ [v]: "stringEquals", [w]: [{ [v]: h, [w]: [p, "name"] }, "aws-us-gov"] }], endpoint: { url: "https://oidc.{Region}.amazonaws.com", properties: n, headers: n }, type: e }, { endpoint: { url: "https://oidc-fips.{Region}.{PartitionResult#dnsSuffix}", properties: n, headers: n }, type: e }], type: f }, { error: "FIPS is enabled but this partition does not support FIPS", type: d }], type: f }, { conditions: s, rules: [{ conditions: [q], rules: [{ endpoint: { url: "https://oidc.{Region}.{PartitionResult#dualStackDnsSuffix}", properties: n, headers: n }, type: e }], type: f }, { error: "DualStack is enabled but this partition does not support DualStack", type: d }], type: f }, { endpoint: { url: "https://oidc.{Region}.{PartitionResult#dnsSuffix}", properties: n, headers: n }, type: e }], type: f }], type: f }, { error: "Invalid Configuration: Missing Region", type: d }] };
const ruleSet = _data;


/***/ }),

/***/ 4505:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   $Command: () => (/* reexport safe */ _commands__WEBPACK_IMPORTED_MODULE_2__.$Command),
/* harmony export */   AccessDeniedException: () => (/* reexport safe */ _models__WEBPACK_IMPORTED_MODULE_3__.AccessDeniedException),
/* harmony export */   AccessDeniedExceptionReason: () => (/* reexport safe */ _models__WEBPACK_IMPORTED_MODULE_3__.AccessDeniedExceptionReason),
/* harmony export */   AuthorizationPendingException: () => (/* reexport safe */ _models__WEBPACK_IMPORTED_MODULE_3__.AuthorizationPendingException),
/* harmony export */   CreateTokenCommand: () => (/* reexport safe */ _commands__WEBPACK_IMPORTED_MODULE_2__.CreateTokenCommand),
/* harmony export */   CreateTokenRequestFilterSensitiveLog: () => (/* reexport safe */ _models__WEBPACK_IMPORTED_MODULE_3__.CreateTokenRequestFilterSensitiveLog),
/* harmony export */   CreateTokenResponseFilterSensitiveLog: () => (/* reexport safe */ _models__WEBPACK_IMPORTED_MODULE_3__.CreateTokenResponseFilterSensitiveLog),
/* harmony export */   ExpiredTokenException: () => (/* reexport safe */ _models__WEBPACK_IMPORTED_MODULE_3__.ExpiredTokenException),
/* harmony export */   InternalServerException: () => (/* reexport safe */ _models__WEBPACK_IMPORTED_MODULE_3__.InternalServerException),
/* harmony export */   InvalidClientException: () => (/* reexport safe */ _models__WEBPACK_IMPORTED_MODULE_3__.InvalidClientException),
/* harmony export */   InvalidGrantException: () => (/* reexport safe */ _models__WEBPACK_IMPORTED_MODULE_3__.InvalidGrantException),
/* harmony export */   InvalidRequestException: () => (/* reexport safe */ _models__WEBPACK_IMPORTED_MODULE_3__.InvalidRequestException),
/* harmony export */   InvalidRequestExceptionReason: () => (/* reexport safe */ _models__WEBPACK_IMPORTED_MODULE_3__.InvalidRequestExceptionReason),
/* harmony export */   InvalidScopeException: () => (/* reexport safe */ _models__WEBPACK_IMPORTED_MODULE_3__.InvalidScopeException),
/* harmony export */   SSOOIDC: () => (/* reexport safe */ _SSOOIDC__WEBPACK_IMPORTED_MODULE_1__.SSOOIDC),
/* harmony export */   SSOOIDCClient: () => (/* reexport safe */ _SSOOIDCClient__WEBPACK_IMPORTED_MODULE_0__.SSOOIDCClient),
/* harmony export */   SSOOIDCServiceException: () => (/* reexport safe */ _models_SSOOIDCServiceException__WEBPACK_IMPORTED_MODULE_4__.SSOOIDCServiceException),
/* harmony export */   SlowDownException: () => (/* reexport safe */ _models__WEBPACK_IMPORTED_MODULE_3__.SlowDownException),
/* harmony export */   UnauthorizedClientException: () => (/* reexport safe */ _models__WEBPACK_IMPORTED_MODULE_3__.UnauthorizedClientException),
/* harmony export */   UnsupportedGrantTypeException: () => (/* reexport safe */ _models__WEBPACK_IMPORTED_MODULE_3__.UnsupportedGrantTypeException),
/* harmony export */   __Client: () => (/* reexport safe */ _SSOOIDCClient__WEBPACK_IMPORTED_MODULE_0__.__Client)
/* harmony export */ });
/* harmony import */ var _SSOOIDCClient__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(4506);
/* harmony import */ var _SSOOIDC__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(4516);
/* harmony import */ var _commands__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(4521);
/* harmony import */ var _models__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(4522);
/* harmony import */ var _models_SSOOIDCServiceException__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(4519);







/***/ }),

/***/ 4519:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   SSOOIDCServiceException: () => (/* binding */ SSOOIDCServiceException),
/* harmony export */   __ServiceException: () => (/* reexport safe */ _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_0__.ServiceException)
/* harmony export */ });
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3129);


class SSOOIDCServiceException extends _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_0__.ServiceException {
    constructor(options) {
        super(options);
        Object.setPrototypeOf(this, SSOOIDCServiceException.prototype);
    }
}


/***/ }),

/***/ 4522:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   AccessDeniedException: () => (/* reexport safe */ _models_0__WEBPACK_IMPORTED_MODULE_0__.AccessDeniedException),
/* harmony export */   AccessDeniedExceptionReason: () => (/* reexport safe */ _models_0__WEBPACK_IMPORTED_MODULE_0__.AccessDeniedExceptionReason),
/* harmony export */   AuthorizationPendingException: () => (/* reexport safe */ _models_0__WEBPACK_IMPORTED_MODULE_0__.AuthorizationPendingException),
/* harmony export */   CreateTokenRequestFilterSensitiveLog: () => (/* reexport safe */ _models_0__WEBPACK_IMPORTED_MODULE_0__.CreateTokenRequestFilterSensitiveLog),
/* harmony export */   CreateTokenResponseFilterSensitiveLog: () => (/* reexport safe */ _models_0__WEBPACK_IMPORTED_MODULE_0__.CreateTokenResponseFilterSensitiveLog),
/* harmony export */   ExpiredTokenException: () => (/* reexport safe */ _models_0__WEBPACK_IMPORTED_MODULE_0__.ExpiredTokenException),
/* harmony export */   InternalServerException: () => (/* reexport safe */ _models_0__WEBPACK_IMPORTED_MODULE_0__.InternalServerException),
/* harmony export */   InvalidClientException: () => (/* reexport safe */ _models_0__WEBPACK_IMPORTED_MODULE_0__.InvalidClientException),
/* harmony export */   InvalidGrantException: () => (/* reexport safe */ _models_0__WEBPACK_IMPORTED_MODULE_0__.InvalidGrantException),
/* harmony export */   InvalidRequestException: () => (/* reexport safe */ _models_0__WEBPACK_IMPORTED_MODULE_0__.InvalidRequestException),
/* harmony export */   InvalidRequestExceptionReason: () => (/* reexport safe */ _models_0__WEBPACK_IMPORTED_MODULE_0__.InvalidRequestExceptionReason),
/* harmony export */   InvalidScopeException: () => (/* reexport safe */ _models_0__WEBPACK_IMPORTED_MODULE_0__.InvalidScopeException),
/* harmony export */   SlowDownException: () => (/* reexport safe */ _models_0__WEBPACK_IMPORTED_MODULE_0__.SlowDownException),
/* harmony export */   UnauthorizedClientException: () => (/* reexport safe */ _models_0__WEBPACK_IMPORTED_MODULE_0__.UnauthorizedClientException),
/* harmony export */   UnsupportedGrantTypeException: () => (/* reexport safe */ _models_0__WEBPACK_IMPORTED_MODULE_0__.UnsupportedGrantTypeException)
/* harmony export */ });
/* harmony import */ var _models_0__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(4518);



/***/ }),

/***/ 4518:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   AccessDeniedException: () => (/* binding */ AccessDeniedException),
/* harmony export */   AccessDeniedExceptionReason: () => (/* binding */ AccessDeniedExceptionReason),
/* harmony export */   AuthorizationPendingException: () => (/* binding */ AuthorizationPendingException),
/* harmony export */   CreateTokenRequestFilterSensitiveLog: () => (/* binding */ CreateTokenRequestFilterSensitiveLog),
/* harmony export */   CreateTokenResponseFilterSensitiveLog: () => (/* binding */ CreateTokenResponseFilterSensitiveLog),
/* harmony export */   ExpiredTokenException: () => (/* binding */ ExpiredTokenException),
/* harmony export */   InternalServerException: () => (/* binding */ InternalServerException),
/* harmony export */   InvalidClientException: () => (/* binding */ InvalidClientException),
/* harmony export */   InvalidGrantException: () => (/* binding */ InvalidGrantException),
/* harmony export */   InvalidRequestException: () => (/* binding */ InvalidRequestException),
/* harmony export */   InvalidRequestExceptionReason: () => (/* binding */ InvalidRequestExceptionReason),
/* harmony export */   InvalidScopeException: () => (/* binding */ InvalidScopeException),
/* harmony export */   SlowDownException: () => (/* binding */ SlowDownException),
/* harmony export */   UnauthorizedClientException: () => (/* binding */ UnauthorizedClientException),
/* harmony export */   UnsupportedGrantTypeException: () => (/* binding */ UnsupportedGrantTypeException)
/* harmony export */ });
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3130);
/* harmony import */ var _SSOOIDCServiceException__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(4519);


const AccessDeniedExceptionReason = {
    KMS_ACCESS_DENIED: "KMS_AccessDeniedException",
};
class AccessDeniedException extends _SSOOIDCServiceException__WEBPACK_IMPORTED_MODULE_0__.SSOOIDCServiceException {
    name = "AccessDeniedException";
    $fault = "client";
    error;
    reason;
    error_description;
    constructor(opts) {
        super({
            name: "AccessDeniedException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, AccessDeniedException.prototype);
        this.error = opts.error;
        this.reason = opts.reason;
        this.error_description = opts.error_description;
    }
}
class AuthorizationPendingException extends _SSOOIDCServiceException__WEBPACK_IMPORTED_MODULE_0__.SSOOIDCServiceException {
    name = "AuthorizationPendingException";
    $fault = "client";
    error;
    error_description;
    constructor(opts) {
        super({
            name: "AuthorizationPendingException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, AuthorizationPendingException.prototype);
        this.error = opts.error;
        this.error_description = opts.error_description;
    }
}
const CreateTokenRequestFilterSensitiveLog = (obj) => ({
    ...obj,
    ...(obj.clientSecret && { clientSecret: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.SENSITIVE_STRING }),
    ...(obj.refreshToken && { refreshToken: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.SENSITIVE_STRING }),
    ...(obj.codeVerifier && { codeVerifier: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.SENSITIVE_STRING }),
});
const CreateTokenResponseFilterSensitiveLog = (obj) => ({
    ...obj,
    ...(obj.accessToken && { accessToken: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.SENSITIVE_STRING }),
    ...(obj.refreshToken && { refreshToken: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.SENSITIVE_STRING }),
    ...(obj.idToken && { idToken: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.SENSITIVE_STRING }),
});
class ExpiredTokenException extends _SSOOIDCServiceException__WEBPACK_IMPORTED_MODULE_0__.SSOOIDCServiceException {
    name = "ExpiredTokenException";
    $fault = "client";
    error;
    error_description;
    constructor(opts) {
        super({
            name: "ExpiredTokenException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, ExpiredTokenException.prototype);
        this.error = opts.error;
        this.error_description = opts.error_description;
    }
}
class InternalServerException extends _SSOOIDCServiceException__WEBPACK_IMPORTED_MODULE_0__.SSOOIDCServiceException {
    name = "InternalServerException";
    $fault = "server";
    error;
    error_description;
    constructor(opts) {
        super({
            name: "InternalServerException",
            $fault: "server",
            ...opts,
        });
        Object.setPrototypeOf(this, InternalServerException.prototype);
        this.error = opts.error;
        this.error_description = opts.error_description;
    }
}
class InvalidClientException extends _SSOOIDCServiceException__WEBPACK_IMPORTED_MODULE_0__.SSOOIDCServiceException {
    name = "InvalidClientException";
    $fault = "client";
    error;
    error_description;
    constructor(opts) {
        super({
            name: "InvalidClientException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, InvalidClientException.prototype);
        this.error = opts.error;
        this.error_description = opts.error_description;
    }
}
class InvalidGrantException extends _SSOOIDCServiceException__WEBPACK_IMPORTED_MODULE_0__.SSOOIDCServiceException {
    name = "InvalidGrantException";
    $fault = "client";
    error;
    error_description;
    constructor(opts) {
        super({
            name: "InvalidGrantException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, InvalidGrantException.prototype);
        this.error = opts.error;
        this.error_description = opts.error_description;
    }
}
const InvalidRequestExceptionReason = {
    KMS_DISABLED_KEY: "KMS_DisabledException",
    KMS_INVALID_KEY_USAGE: "KMS_InvalidKeyUsageException",
    KMS_INVALID_STATE: "KMS_InvalidStateException",
    KMS_KEY_NOT_FOUND: "KMS_NotFoundException",
};
class InvalidRequestException extends _SSOOIDCServiceException__WEBPACK_IMPORTED_MODULE_0__.SSOOIDCServiceException {
    name = "InvalidRequestException";
    $fault = "client";
    error;
    reason;
    error_description;
    constructor(opts) {
        super({
            name: "InvalidRequestException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, InvalidRequestException.prototype);
        this.error = opts.error;
        this.reason = opts.reason;
        this.error_description = opts.error_description;
    }
}
class InvalidScopeException extends _SSOOIDCServiceException__WEBPACK_IMPORTED_MODULE_0__.SSOOIDCServiceException {
    name = "InvalidScopeException";
    $fault = "client";
    error;
    error_description;
    constructor(opts) {
        super({
            name: "InvalidScopeException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, InvalidScopeException.prototype);
        this.error = opts.error;
        this.error_description = opts.error_description;
    }
}
class SlowDownException extends _SSOOIDCServiceException__WEBPACK_IMPORTED_MODULE_0__.SSOOIDCServiceException {
    name = "SlowDownException";
    $fault = "client";
    error;
    error_description;
    constructor(opts) {
        super({
            name: "SlowDownException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, SlowDownException.prototype);
        this.error = opts.error;
        this.error_description = opts.error_description;
    }
}
class UnauthorizedClientException extends _SSOOIDCServiceException__WEBPACK_IMPORTED_MODULE_0__.SSOOIDCServiceException {
    name = "UnauthorizedClientException";
    $fault = "client";
    error;
    error_description;
    constructor(opts) {
        super({
            name: "UnauthorizedClientException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, UnauthorizedClientException.prototype);
        this.error = opts.error;
        this.error_description = opts.error_description;
    }
}
class UnsupportedGrantTypeException extends _SSOOIDCServiceException__WEBPACK_IMPORTED_MODULE_0__.SSOOIDCServiceException {
    name = "UnsupportedGrantTypeException";
    $fault = "client";
    error;
    error_description;
    constructor(opts) {
        super({
            name: "UnsupportedGrantTypeException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, UnsupportedGrantTypeException.prototype);
        this.error = opts.error;
        this.error_description = opts.error_description;
    }
}


/***/ }),

/***/ 4520:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   de_CreateTokenCommand: () => (/* binding */ de_CreateTokenCommand),
/* harmony export */   se_CreateTokenCommand: () => (/* binding */ se_CreateTokenCommand)
/* harmony export */ });
/* harmony import */ var _aws_sdk_core__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(4493);
/* harmony import */ var _smithy_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3133);
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3136);
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(4494);
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(3139);
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(3170);
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(3129);
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(3149);
/* harmony import */ var _models_models_0__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(4518);
/* harmony import */ var _models_SSOOIDCServiceException__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(4519);





const se_CreateTokenCommand = async (input, context) => {
    const b = (0,_smithy_core__WEBPACK_IMPORTED_MODULE_0__.requestBuilder)(input, context);
    const headers = {
        "content-type": "application/json",
    };
    b.bp("/token");
    let body;
    body = JSON.stringify((0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.take)(input, {
        clientId: [],
        clientSecret: [],
        code: [],
        codeVerifier: [],
        deviceCode: [],
        grantType: [],
        redirectUri: [],
        refreshToken: [],
        scope: (_) => (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_2__._json)(_),
    }));
    b.m("POST").h(headers).b(body);
    return b.build();
};
const de_CreateTokenCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectNonNull)((0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectObject)(await (0,_aws_sdk_core__WEBPACK_IMPORTED_MODULE_4__.parseJsonBody)(output.body, context)), "body");
    const doc = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.take)(data, {
        accessToken: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString,
        expiresIn: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectInt32,
        idToken: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString,
        refreshToken: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString,
        tokenType: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString,
    });
    Object.assign(contents, doc);
    return contents;
};
const de_CommandError = async (output, context) => {
    const parsedOutput = {
        ...output,
        body: await (0,_aws_sdk_core__WEBPACK_IMPORTED_MODULE_4__.parseJsonErrorBody)(output.body, context),
    };
    const errorCode = (0,_aws_sdk_core__WEBPACK_IMPORTED_MODULE_4__.loadRestJsonErrorCode)(output, parsedOutput.body);
    switch (errorCode) {
        case "AccessDeniedException":
        case "com.amazonaws.ssooidc#AccessDeniedException":
            throw await de_AccessDeniedExceptionRes(parsedOutput, context);
        case "AuthorizationPendingException":
        case "com.amazonaws.ssooidc#AuthorizationPendingException":
            throw await de_AuthorizationPendingExceptionRes(parsedOutput, context);
        case "ExpiredTokenException":
        case "com.amazonaws.ssooidc#ExpiredTokenException":
            throw await de_ExpiredTokenExceptionRes(parsedOutput, context);
        case "InternalServerException":
        case "com.amazonaws.ssooidc#InternalServerException":
            throw await de_InternalServerExceptionRes(parsedOutput, context);
        case "InvalidClientException":
        case "com.amazonaws.ssooidc#InvalidClientException":
            throw await de_InvalidClientExceptionRes(parsedOutput, context);
        case "InvalidGrantException":
        case "com.amazonaws.ssooidc#InvalidGrantException":
            throw await de_InvalidGrantExceptionRes(parsedOutput, context);
        case "InvalidRequestException":
        case "com.amazonaws.ssooidc#InvalidRequestException":
            throw await de_InvalidRequestExceptionRes(parsedOutput, context);
        case "InvalidScopeException":
        case "com.amazonaws.ssooidc#InvalidScopeException":
            throw await de_InvalidScopeExceptionRes(parsedOutput, context);
        case "SlowDownException":
        case "com.amazonaws.ssooidc#SlowDownException":
            throw await de_SlowDownExceptionRes(parsedOutput, context);
        case "UnauthorizedClientException":
        case "com.amazonaws.ssooidc#UnauthorizedClientException":
            throw await de_UnauthorizedClientExceptionRes(parsedOutput, context);
        case "UnsupportedGrantTypeException":
        case "com.amazonaws.ssooidc#UnsupportedGrantTypeException":
            throw await de_UnsupportedGrantTypeExceptionRes(parsedOutput, context);
        default:
            const parsedBody = parsedOutput.body;
            return throwDefaultError({
                output,
                parsedBody,
                errorCode,
            });
    }
};
const throwDefaultError = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_5__.withBaseException)(_models_SSOOIDCServiceException__WEBPACK_IMPORTED_MODULE_6__.SSOOIDCServiceException);
const de_AccessDeniedExceptionRes = async (parsedOutput, context) => {
    const contents = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.map)({});
    const data = parsedOutput.body;
    const doc = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.take)(data, {
        error: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString,
        error_description: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString,
        reason: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString,
    });
    Object.assign(contents, doc);
    const exception = new _models_models_0__WEBPACK_IMPORTED_MODULE_7__.AccessDeniedException({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents,
    });
    return (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_8__.decorateServiceException)(exception, parsedOutput.body);
};
const de_AuthorizationPendingExceptionRes = async (parsedOutput, context) => {
    const contents = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.map)({});
    const data = parsedOutput.body;
    const doc = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.take)(data, {
        error: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString,
        error_description: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString,
    });
    Object.assign(contents, doc);
    const exception = new _models_models_0__WEBPACK_IMPORTED_MODULE_7__.AuthorizationPendingException({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents,
    });
    return (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_8__.decorateServiceException)(exception, parsedOutput.body);
};
const de_ExpiredTokenExceptionRes = async (parsedOutput, context) => {
    const contents = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.map)({});
    const data = parsedOutput.body;
    const doc = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.take)(data, {
        error: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString,
        error_description: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString,
    });
    Object.assign(contents, doc);
    const exception = new _models_models_0__WEBPACK_IMPORTED_MODULE_7__.ExpiredTokenException({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents,
    });
    return (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_8__.decorateServiceException)(exception, parsedOutput.body);
};
const de_InternalServerExceptionRes = async (parsedOutput, context) => {
    const contents = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.map)({});
    const data = parsedOutput.body;
    const doc = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.take)(data, {
        error: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString,
        error_description: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString,
    });
    Object.assign(contents, doc);
    const exception = new _models_models_0__WEBPACK_IMPORTED_MODULE_7__.InternalServerException({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents,
    });
    return (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_8__.decorateServiceException)(exception, parsedOutput.body);
};
const de_InvalidClientExceptionRes = async (parsedOutput, context) => {
    const contents = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.map)({});
    const data = parsedOutput.body;
    const doc = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.take)(data, {
        error: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString,
        error_description: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString,
    });
    Object.assign(contents, doc);
    const exception = new _models_models_0__WEBPACK_IMPORTED_MODULE_7__.InvalidClientException({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents,
    });
    return (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_8__.decorateServiceException)(exception, parsedOutput.body);
};
const de_InvalidGrantExceptionRes = async (parsedOutput, context) => {
    const contents = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.map)({});
    const data = parsedOutput.body;
    const doc = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.take)(data, {
        error: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString,
        error_description: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString,
    });
    Object.assign(contents, doc);
    const exception = new _models_models_0__WEBPACK_IMPORTED_MODULE_7__.InvalidGrantException({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents,
    });
    return (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_8__.decorateServiceException)(exception, parsedOutput.body);
};
const de_InvalidRequestExceptionRes = async (parsedOutput, context) => {
    const contents = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.map)({});
    const data = parsedOutput.body;
    const doc = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.take)(data, {
        error: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString,
        error_description: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString,
        reason: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString,
    });
    Object.assign(contents, doc);
    const exception = new _models_models_0__WEBPACK_IMPORTED_MODULE_7__.InvalidRequestException({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents,
    });
    return (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_8__.decorateServiceException)(exception, parsedOutput.body);
};
const de_InvalidScopeExceptionRes = async (parsedOutput, context) => {
    const contents = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.map)({});
    const data = parsedOutput.body;
    const doc = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.take)(data, {
        error: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString,
        error_description: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString,
    });
    Object.assign(contents, doc);
    const exception = new _models_models_0__WEBPACK_IMPORTED_MODULE_7__.InvalidScopeException({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents,
    });
    return (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_8__.decorateServiceException)(exception, parsedOutput.body);
};
const de_SlowDownExceptionRes = async (parsedOutput, context) => {
    const contents = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.map)({});
    const data = parsedOutput.body;
    const doc = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.take)(data, {
        error: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString,
        error_description: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString,
    });
    Object.assign(contents, doc);
    const exception = new _models_models_0__WEBPACK_IMPORTED_MODULE_7__.SlowDownException({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents,
    });
    return (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_8__.decorateServiceException)(exception, parsedOutput.body);
};
const de_UnauthorizedClientExceptionRes = async (parsedOutput, context) => {
    const contents = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.map)({});
    const data = parsedOutput.body;
    const doc = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.take)(data, {
        error: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString,
        error_description: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString,
    });
    Object.assign(contents, doc);
    const exception = new _models_models_0__WEBPACK_IMPORTED_MODULE_7__.UnauthorizedClientException({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents,
    });
    return (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_8__.decorateServiceException)(exception, parsedOutput.body);
};
const de_UnsupportedGrantTypeExceptionRes = async (parsedOutput, context) => {
    const contents = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.map)({});
    const data = parsedOutput.body;
    const doc = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.take)(data, {
        error: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString,
        error_description: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString,
    });
    Object.assign(contents, doc);
    const exception = new _models_models_0__WEBPACK_IMPORTED_MODULE_7__.UnsupportedGrantTypeException({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents,
    });
    return (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_8__.decorateServiceException)(exception, parsedOutput.body);
};
const deserializeMetadata = (output) => ({
    httpStatusCode: output.statusCode,
    requestId: output.headers["x-amzn-requestid"] ?? output.headers["x-amzn-request-id"] ?? output.headers["x-amz-request-id"],
    extendedRequestId: output.headers["x-amz-id-2"],
    cfId: output.headers["x-amz-cf-id"],
});
const collectBodyString = (streamBody, context) => (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_9__.collectBody)(streamBody, context).then((body) => context.utf8Encoder(body));


/***/ }),

/***/ 4509:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getRuntimeConfig: () => (/* binding */ getRuntimeConfig)
/* harmony export */ });
/* harmony import */ var _package_json__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(4510);
/* harmony import */ var _aws_sdk_core__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(3219);
/* harmony import */ var _aws_sdk_core__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(3220);
/* harmony import */ var _aws_sdk_util_user_agent_node__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(3227);
/* harmony import */ var _aws_sdk_util_user_agent_node__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(3285);
/* harmony import */ var _smithy_config_resolver__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(3217);
/* harmony import */ var _smithy_config_resolver__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(3283);
/* harmony import */ var _smithy_config_resolver__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(3284);
/* harmony import */ var _smithy_hash_node__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(3198);
/* harmony import */ var _smithy_middleware_retry__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(3257);
/* harmony import */ var _smithy_node_config_provider__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(3081);
/* harmony import */ var _smithy_node_http_handler__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(3270);
/* harmony import */ var _smithy_node_http_handler__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(3211);
/* harmony import */ var _smithy_util_body_length_node__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(3223);
/* harmony import */ var _smithy_util_retry__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(3258);
/* harmony import */ var _runtimeConfig_shared__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(4511);
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(3218);
/* harmony import */ var _smithy_util_defaults_mode_node__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3214);
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3213);














const getRuntimeConfig = (config) => {
    (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_0__.emitWarningIfUnsupportedVersion)(process.version);
    const defaultsMode = (0,_smithy_util_defaults_mode_node__WEBPACK_IMPORTED_MODULE_1__.resolveDefaultsModeConfig)(config);
    const defaultConfigProvider = () => defaultsMode().then(_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_2__.loadConfigsForDefaultMode);
    const clientSharedValues = (0,_runtimeConfig_shared__WEBPACK_IMPORTED_MODULE_3__.getRuntimeConfig)(config);
    (0,_aws_sdk_core__WEBPACK_IMPORTED_MODULE_4__.emitWarningIfUnsupportedVersion)(process.version);
    const loaderConfig = {
        profile: config?.profile,
        logger: clientSharedValues.logger,
    };
    return {
        ...clientSharedValues,
        ...config,
        runtime: "node",
        defaultsMode,
        authSchemePreference: config?.authSchemePreference ?? (0,_smithy_node_config_provider__WEBPACK_IMPORTED_MODULE_5__.loadConfig)(_aws_sdk_core__WEBPACK_IMPORTED_MODULE_6__.NODE_AUTH_SCHEME_PREFERENCE_OPTIONS, loaderConfig),
        bodyLengthChecker: config?.bodyLengthChecker ?? _smithy_util_body_length_node__WEBPACK_IMPORTED_MODULE_7__.calculateBodyLength,
        defaultUserAgentProvider: config?.defaultUserAgentProvider ??
            (0,_aws_sdk_util_user_agent_node__WEBPACK_IMPORTED_MODULE_8__.createDefaultUserAgentProvider)({ serviceId: clientSharedValues.serviceId, clientVersion: _package_json__WEBPACK_IMPORTED_MODULE_9__.version }),
        maxAttempts: config?.maxAttempts ?? (0,_smithy_node_config_provider__WEBPACK_IMPORTED_MODULE_5__.loadConfig)(_smithy_middleware_retry__WEBPACK_IMPORTED_MODULE_10__.NODE_MAX_ATTEMPT_CONFIG_OPTIONS, config),
        region: config?.region ??
            (0,_smithy_node_config_provider__WEBPACK_IMPORTED_MODULE_5__.loadConfig)(_smithy_config_resolver__WEBPACK_IMPORTED_MODULE_11__.NODE_REGION_CONFIG_OPTIONS, { ..._smithy_config_resolver__WEBPACK_IMPORTED_MODULE_11__.NODE_REGION_CONFIG_FILE_OPTIONS, ...loaderConfig }),
        requestHandler: _smithy_node_http_handler__WEBPACK_IMPORTED_MODULE_12__.NodeHttpHandler.create(config?.requestHandler ?? defaultConfigProvider),
        retryMode: config?.retryMode ??
            (0,_smithy_node_config_provider__WEBPACK_IMPORTED_MODULE_5__.loadConfig)({
                ..._smithy_middleware_retry__WEBPACK_IMPORTED_MODULE_10__.NODE_RETRY_MODE_CONFIG_OPTIONS,
                default: async () => (await defaultConfigProvider()).retryMode || _smithy_util_retry__WEBPACK_IMPORTED_MODULE_13__.DEFAULT_RETRY_MODE,
            }, config),
        sha256: config?.sha256 ?? _smithy_hash_node__WEBPACK_IMPORTED_MODULE_14__.Hash.bind(null, "sha256"),
        streamCollector: config?.streamCollector ?? _smithy_node_http_handler__WEBPACK_IMPORTED_MODULE_15__.streamCollector,
        useDualstackEndpoint: config?.useDualstackEndpoint ?? (0,_smithy_node_config_provider__WEBPACK_IMPORTED_MODULE_5__.loadConfig)(_smithy_config_resolver__WEBPACK_IMPORTED_MODULE_16__.NODE_USE_DUALSTACK_ENDPOINT_CONFIG_OPTIONS, loaderConfig),
        useFipsEndpoint: config?.useFipsEndpoint ?? (0,_smithy_node_config_provider__WEBPACK_IMPORTED_MODULE_5__.loadConfig)(_smithy_config_resolver__WEBPACK_IMPORTED_MODULE_17__.NODE_USE_FIPS_ENDPOINT_CONFIG_OPTIONS, loaderConfig),
        userAgentAppId: config?.userAgentAppId ?? (0,_smithy_node_config_provider__WEBPACK_IMPORTED_MODULE_5__.loadConfig)(_aws_sdk_util_user_agent_node__WEBPACK_IMPORTED_MODULE_18__.NODE_APP_ID_CONFIG_OPTIONS, loaderConfig),
    };
};


/***/ }),

/***/ 4511:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getRuntimeConfig: () => (/* binding */ getRuntimeConfig)
/* harmony export */ });
/* harmony import */ var _aws_sdk_core__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(3201);
/* harmony import */ var _smithy_core__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(4502);
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(3207);
/* harmony import */ var _smithy_url_parser__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(3026);
/* harmony import */ var _smithy_util_base64__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3154);
/* harmony import */ var _smithy_util_base64__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3152);
/* harmony import */ var _smithy_util_utf8__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(3107);
/* harmony import */ var _smithy_util_utf8__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(3153);
/* harmony import */ var _auth_httpAuthSchemeProvider__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(4507);
/* harmony import */ var _endpoint_endpointResolver__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(4512);








const getRuntimeConfig = (config) => {
    return {
        apiVersion: "2019-06-10",
        base64Decoder: config?.base64Decoder ?? _smithy_util_base64__WEBPACK_IMPORTED_MODULE_0__.fromBase64,
        base64Encoder: config?.base64Encoder ?? _smithy_util_base64__WEBPACK_IMPORTED_MODULE_1__.toBase64,
        disableHostPrefix: config?.disableHostPrefix ?? false,
        endpointProvider: config?.endpointProvider ?? _endpoint_endpointResolver__WEBPACK_IMPORTED_MODULE_2__.defaultEndpointResolver,
        extensions: config?.extensions ?? [],
        httpAuthSchemeProvider: config?.httpAuthSchemeProvider ?? _auth_httpAuthSchemeProvider__WEBPACK_IMPORTED_MODULE_3__.defaultSSOOIDCHttpAuthSchemeProvider,
        httpAuthSchemes: config?.httpAuthSchemes ?? [
            {
                schemeId: "aws.auth#sigv4",
                identityProvider: (ipc) => ipc.getIdentityProvider("aws.auth#sigv4"),
                signer: new _aws_sdk_core__WEBPACK_IMPORTED_MODULE_4__.AwsSdkSigV4Signer(),
            },
            {
                schemeId: "smithy.api#noAuth",
                identityProvider: (ipc) => ipc.getIdentityProvider("smithy.api#noAuth") || (async () => ({})),
                signer: new _smithy_core__WEBPACK_IMPORTED_MODULE_5__.NoAuthSigner(),
            },
        ],
        logger: config?.logger ?? new _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_6__.NoOpLogger(),
        serviceId: config?.serviceId ?? "SSO OIDC",
        urlParser: config?.urlParser ?? _smithy_url_parser__WEBPACK_IMPORTED_MODULE_7__.parseUrl,
        utf8Decoder: config?.utf8Decoder ?? _smithy_util_utf8__WEBPACK_IMPORTED_MODULE_8__.fromUtf8,
        utf8Encoder: config?.utf8Encoder ?? _smithy_util_utf8__WEBPACK_IMPORTED_MODULE_9__.toUtf8,
    };
};


/***/ }),

/***/ 4514:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   resolveRuntimeExtensions: () => (/* binding */ resolveRuntimeExtensions)
/* harmony export */ });
/* harmony import */ var _aws_sdk_region_config_resolver__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3289);
/* harmony import */ var _smithy_protocol_http__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(3294);
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3290);
/* harmony import */ var _auth_httpAuthExtensionConfiguration__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(4515);




const resolveRuntimeExtensions = (runtimeConfig, extensions) => {
    const extensionConfiguration = Object.assign((0,_aws_sdk_region_config_resolver__WEBPACK_IMPORTED_MODULE_0__.getAwsRegionExtensionConfiguration)(runtimeConfig), (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.getDefaultExtensionConfiguration)(runtimeConfig), (0,_smithy_protocol_http__WEBPACK_IMPORTED_MODULE_2__.getHttpHandlerExtensionConfiguration)(runtimeConfig), (0,_auth_httpAuthExtensionConfiguration__WEBPACK_IMPORTED_MODULE_3__.getHttpAuthExtensionConfiguration)(runtimeConfig));
    extensions.forEach((extension) => extension.configure(extensionConfiguration));
    return Object.assign(runtimeConfig, (0,_aws_sdk_region_config_resolver__WEBPACK_IMPORTED_MODULE_0__.resolveAwsRegionExtensionConfiguration)(extensionConfiguration), (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.resolveDefaultRuntimeConfig)(extensionConfiguration), (0,_smithy_protocol_http__WEBPACK_IMPORTED_MODULE_2__.resolveHttpHandlerRuntimeConfig)(extensionConfiguration), (0,_auth_httpAuthExtensionConfiguration__WEBPACK_IMPORTED_MODULE_3__.resolveHttpAuthRuntimeConfig)(extensionConfiguration));
};


/***/ }),

/***/ 4502:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   NoAuthSigner: () => (/* binding */ NoAuthSigner)
/* harmony export */ });
class NoAuthSigner {
    async sign(httpRequest, identity, signingProperties) {
        return httpRequest;
    }
}


/***/ }),

/***/ 4494:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   _json: () => (/* binding */ _json)
/* harmony export */ });
const _json = (obj) => {
    if (obj == null) {
        return {};
    }
    if (Array.isArray(obj)) {
        return obj.filter((_) => _ != null).map(_json);
    }
    if (typeof obj === "object") {
        const target = {};
        for (const key of Object.keys(obj)) {
            if (obj[key] == null) {
                continue;
            }
            target[key] = _json(obj[key]);
        }
        return target;
    }
    return obj;
};


/***/ }),

/***/ 4510:
/***/ ((module) => {

module.exports = /*#__PURE__*/JSON.parse('{"name":"@aws-sdk/nested-clients","version":"3.901.0","description":"Nested clients for AWS SDK packages.","main":"./dist-cjs/index.js","module":"./dist-es/index.js","types":"./dist-types/index.d.ts","scripts":{"build":"yarn lint && concurrently \'yarn:build:cjs\' \'yarn:build:es\' \'yarn:build:types\'","build:cjs":"node ../../scripts/compilation/inline nested-clients","build:es":"tsc -p tsconfig.es.json","build:include:deps":"lerna run --scope $npm_package_name --include-dependencies build","build:types":"tsc -p tsconfig.types.json","build:types:downlevel":"downlevel-dts dist-types dist-types/ts3.4","clean":"rimraf ./dist-* && rimraf *.tsbuildinfo","lint":"node ../../scripts/validation/submodules-linter.js --pkg nested-clients","test":"yarn g:vitest run","test:watch":"yarn g:vitest watch"},"engines":{"node":">=18.0.0"},"sideEffects":false,"author":{"name":"AWS SDK for JavaScript Team","url":"https://aws.amazon.com/javascript/"},"license":"Apache-2.0","dependencies":{"@aws-crypto/sha256-browser":"5.2.0","@aws-crypto/sha256-js":"5.2.0","@aws-sdk/core":"3.901.0","@aws-sdk/middleware-host-header":"3.901.0","@aws-sdk/middleware-logger":"3.901.0","@aws-sdk/middleware-recursion-detection":"3.901.0","@aws-sdk/middleware-user-agent":"3.901.0","@aws-sdk/region-config-resolver":"3.901.0","@aws-sdk/types":"3.901.0","@aws-sdk/util-endpoints":"3.901.0","@aws-sdk/util-user-agent-browser":"3.901.0","@aws-sdk/util-user-agent-node":"3.901.0","@smithy/config-resolver":"^4.3.0","@smithy/core":"^3.14.0","@smithy/fetch-http-handler":"^5.3.0","@smithy/hash-node":"^4.2.0","@smithy/invalid-dependency":"^4.2.0","@smithy/middleware-content-length":"^4.2.0","@smithy/middleware-endpoint":"^4.3.0","@smithy/middleware-retry":"^4.4.0","@smithy/middleware-serde":"^4.2.0","@smithy/middleware-stack":"^4.2.0","@smithy/node-config-provider":"^4.3.0","@smithy/node-http-handler":"^4.3.0","@smithy/protocol-http":"^5.3.0","@smithy/smithy-client":"^4.7.0","@smithy/types":"^4.6.0","@smithy/url-parser":"^4.2.0","@smithy/util-base64":"^4.2.0","@smithy/util-body-length-browser":"^4.2.0","@smithy/util-body-length-node":"^4.2.0","@smithy/util-defaults-mode-browser":"^4.2.0","@smithy/util-defaults-mode-node":"^4.2.0","@smithy/util-endpoints":"^3.2.0","@smithy/util-middleware":"^4.2.0","@smithy/util-retry":"^4.2.0","@smithy/util-utf8":"^4.2.0","tslib":"^2.6.2"},"devDependencies":{"concurrently":"7.0.0","downlevel-dts":"0.10.1","rimraf":"3.0.2","typescript":"~5.8.3"},"typesVersions":{"<4.0":{"dist-types/*":["dist-types/ts3.4/*"]}},"files":["./sso-oidc.d.ts","./sso-oidc.js","./sts.d.ts","./sts.js","dist-*/**"],"browser":{"./dist-es/submodules/sso-oidc/runtimeConfig":"./dist-es/submodules/sso-oidc/runtimeConfig.browser","./dist-es/submodules/sts/runtimeConfig":"./dist-es/submodules/sts/runtimeConfig.browser"},"react-native":{},"homepage":"https://github.com/aws/aws-sdk-js-v3/tree/main/packages/nested-clients","repository":{"type":"git","url":"https://github.com/aws/aws-sdk-js-v3.git","directory":"packages/nested-clients"},"exports":{"./sso-oidc":{"types":"./dist-types/submodules/sso-oidc/index.d.ts","module":"./dist-es/submodules/sso-oidc/index.js","node":"./dist-cjs/submodules/sso-oidc/index.js","import":"./dist-es/submodules/sso-oidc/index.js","require":"./dist-cjs/submodules/sso-oidc/index.js"},"./sts":{"types":"./dist-types/submodules/sts/index.d.ts","module":"./dist-es/submodules/sts/index.js","node":"./dist-cjs/submodules/sts/index.js","import":"./dist-es/submodules/sts/index.js","require":"./dist-cjs/submodules/sts/index.js"}}}');

/***/ })

};
;