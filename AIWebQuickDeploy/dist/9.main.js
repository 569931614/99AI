"use strict";
exports.id = 9;
exports.ids = [9];
exports.modules = {

/***/ 4376:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   SSOClient: () => (/* binding */ SSOClient),
/* harmony export */   __Client: () => (/* reexport safe */ _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_0__.Client)
/* harmony export */ });
/* harmony import */ var _aws_sdk_middleware_host_header__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(2959);
/* harmony import */ var _aws_sdk_middleware_logger__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(3262);
/* harmony import */ var _aws_sdk_middleware_recursion_detection__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(3263);
/* harmony import */ var _aws_sdk_middleware_user_agent__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(3234);
/* harmony import */ var _aws_sdk_middleware_user_agent__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(3254);
/* harmony import */ var _smithy_config_resolver__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(3245);
/* harmony import */ var _smithy_core__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(3267);
/* harmony import */ var _smithy_core__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(3270);
/* harmony import */ var _smithy_core__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(3271);
/* harmony import */ var _smithy_middleware_content_length__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(2960);
/* harmony import */ var _smithy_middleware_endpoint__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(3248);
/* harmony import */ var _smithy_middleware_retry__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(3205);
/* harmony import */ var _smithy_middleware_retry__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(3259);
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3243);
/* harmony import */ var _auth_httpAuthSchemeProvider__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(4377);
/* harmony import */ var _endpoint_EndpointParameters__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(4370);
/* harmony import */ var _runtimeConfig__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(4378);
/* harmony import */ var _runtimeExtensions__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(4384);















class SSOClient extends _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_0__.Client {
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
            httpAuthSchemeParametersProvider: _auth_httpAuthSchemeProvider__WEBPACK_IMPORTED_MODULE_8__.defaultSSOHttpAuthSchemeParametersProvider,
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

/***/ 4385:
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

/***/ 4377:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   defaultSSOHttpAuthSchemeParametersProvider: () => (/* binding */ defaultSSOHttpAuthSchemeParametersProvider),
/* harmony export */   defaultSSOHttpAuthSchemeProvider: () => (/* binding */ defaultSSOHttpAuthSchemeProvider),
/* harmony export */   resolveHttpAuthSchemeConfig: () => (/* binding */ resolveHttpAuthSchemeConfig)
/* harmony export */ });
/* harmony import */ var _aws_sdk_core__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(3068);
/* harmony import */ var _smithy_util_middleware__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3015);
/* harmony import */ var _smithy_util_middleware__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3042);


const defaultSSOHttpAuthSchemeParametersProvider = async (config, context, input) => {
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
            name: "awsssoportal",
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
const defaultSSOHttpAuthSchemeProvider = (authParameters) => {
    const options = [];
    switch (authParameters.operation) {
        case "GetRoleCredentials": {
            options.push(createSmithyApiNoAuthHttpAuthOption(authParameters));
            break;
        }
        case "ListAccountRoles": {
            options.push(createSmithyApiNoAuthHttpAuthOption(authParameters));
            break;
        }
        case "ListAccounts": {
            options.push(createSmithyApiNoAuthHttpAuthOption(authParameters));
            break;
        }
        case "Logout": {
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

/***/ 4369:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   $Command: () => (/* reexport safe */ _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_0__.Command),
/* harmony export */   GetRoleCredentialsCommand: () => (/* binding */ GetRoleCredentialsCommand)
/* harmony export */ });
/* harmony import */ var _smithy_middleware_endpoint__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(3135);
/* harmony import */ var _smithy_middleware_serde__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(3131);
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3119);
/* harmony import */ var _endpoint_EndpointParameters__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(4370);
/* harmony import */ var _models_models_0__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(4371);
/* harmony import */ var _protocols_Aws_restJson1__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(4373);







class GetRoleCredentialsCommand extends _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_0__.Command
    .classBuilder()
    .ep(_endpoint_EndpointParameters__WEBPACK_IMPORTED_MODULE_1__.commonParams)
    .m(function (Command, cs, config, o) {
    return [
        (0,_smithy_middleware_serde__WEBPACK_IMPORTED_MODULE_2__.getSerdePlugin)(config, this.serialize, this.deserialize),
        (0,_smithy_middleware_endpoint__WEBPACK_IMPORTED_MODULE_3__.getEndpointPlugin)(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("SWBPortalService", "GetRoleCredentials", {})
    .n("SSOClient", "GetRoleCredentialsCommand")
    .f(_models_models_0__WEBPACK_IMPORTED_MODULE_4__.GetRoleCredentialsRequestFilterSensitiveLog, _models_models_0__WEBPACK_IMPORTED_MODULE_4__.GetRoleCredentialsResponseFilterSensitiveLog)
    .ser(_protocols_Aws_restJson1__WEBPACK_IMPORTED_MODULE_5__.se_GetRoleCredentialsCommand)
    .de(_protocols_Aws_restJson1__WEBPACK_IMPORTED_MODULE_5__.de_GetRoleCredentialsCommand)
    .build() {
}


/***/ }),

/***/ 4370:
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
        defaultSigningName: "awsssoportal",
    });
};
const commonParams = {
    UseFIPS: { type: "builtInParams", name: "useFipsEndpoint" },
    Endpoint: { type: "builtInParams", name: "endpoint" },
    Region: { type: "builtInParams", name: "region" },
    UseDualStack: { type: "builtInParams", name: "useDualstackEndpoint" },
};


/***/ }),

/***/ 4381:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   defaultEndpointResolver: () => (/* binding */ defaultEndpointResolver)
/* harmony export */ });
/* harmony import */ var _aws_sdk_util_endpoints__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2963);
/* harmony import */ var _smithy_util_endpoints__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3014);
/* harmony import */ var _smithy_util_endpoints__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(2977);
/* harmony import */ var _smithy_util_endpoints__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(2972);
/* harmony import */ var _ruleset__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(4382);



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

/***/ 4382:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ruleSet: () => (/* binding */ ruleSet)
/* harmony export */ });
const u = "required", v = "fn", w = "argv", x = "ref";
const a = true, b = "isSet", c = "booleanEquals", d = "error", e = "endpoint", f = "tree", g = "PartitionResult", h = "getAttr", i = { [u]: false, "type": "String" }, j = { [u]: true, "default": false, "type": "Boolean" }, k = { [x]: "Endpoint" }, l = { [v]: c, [w]: [{ [x]: "UseFIPS" }, true] }, m = { [v]: c, [w]: [{ [x]: "UseDualStack" }, true] }, n = {}, o = { [v]: h, [w]: [{ [x]: g }, "supportsFIPS"] }, p = { [x]: g }, q = { [v]: c, [w]: [true, { [v]: h, [w]: [p, "supportsDualStack"] }] }, r = [l], s = [m], t = [{ [x]: "Region" }];
const _data = { version: "1.0", parameters: { Region: i, UseDualStack: j, UseFIPS: j, Endpoint: i }, rules: [{ conditions: [{ [v]: b, [w]: [k] }], rules: [{ conditions: r, error: "Invalid Configuration: FIPS and custom endpoint are not supported", type: d }, { conditions: s, error: "Invalid Configuration: Dualstack and custom endpoint are not supported", type: d }, { endpoint: { url: k, properties: n, headers: n }, type: e }], type: f }, { conditions: [{ [v]: b, [w]: t }], rules: [{ conditions: [{ [v]: "aws.partition", [w]: t, assign: g }], rules: [{ conditions: [l, m], rules: [{ conditions: [{ [v]: c, [w]: [a, o] }, q], rules: [{ endpoint: { url: "https://portal.sso-fips.{Region}.{PartitionResult#dualStackDnsSuffix}", properties: n, headers: n }, type: e }], type: f }, { error: "FIPS and DualStack are enabled, but this partition does not support one or both", type: d }], type: f }, { conditions: r, rules: [{ conditions: [{ [v]: c, [w]: [o, a] }], rules: [{ conditions: [{ [v]: "stringEquals", [w]: [{ [v]: h, [w]: [p, "name"] }, "aws-us-gov"] }], endpoint: { url: "https://portal.sso.{Region}.amazonaws.com", properties: n, headers: n }, type: e }, { endpoint: { url: "https://portal.sso-fips.{Region}.{PartitionResult#dnsSuffix}", properties: n, headers: n }, type: e }], type: f }, { error: "FIPS is enabled but this partition does not support FIPS", type: d }], type: f }, { conditions: s, rules: [{ conditions: [q], rules: [{ endpoint: { url: "https://portal.sso.{Region}.{PartitionResult#dualStackDnsSuffix}", properties: n, headers: n }, type: e }], type: f }, { error: "DualStack is enabled but this partition does not support DualStack", type: d }], type: f }, { endpoint: { url: "https://portal.sso.{Region}.{PartitionResult#dnsSuffix}", properties: n, headers: n }, type: e }], type: f }], type: f }, { error: "Invalid Configuration: Missing Region", type: d }] };
const ruleSet = _data;


/***/ }),

/***/ 4372:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   SSOServiceException: () => (/* binding */ SSOServiceException),
/* harmony export */   __ServiceException: () => (/* reexport safe */ _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_0__.ServiceException)
/* harmony export */ });
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3077);


class SSOServiceException extends _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_0__.ServiceException {
    constructor(options) {
        super(options);
        Object.setPrototypeOf(this, SSOServiceException.prototype);
    }
}


/***/ }),

/***/ 4371:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   GetRoleCredentialsRequestFilterSensitiveLog: () => (/* binding */ GetRoleCredentialsRequestFilterSensitiveLog),
/* harmony export */   GetRoleCredentialsResponseFilterSensitiveLog: () => (/* binding */ GetRoleCredentialsResponseFilterSensitiveLog),
/* harmony export */   InvalidRequestException: () => (/* binding */ InvalidRequestException),
/* harmony export */   ListAccountRolesRequestFilterSensitiveLog: () => (/* binding */ ListAccountRolesRequestFilterSensitiveLog),
/* harmony export */   ListAccountsRequestFilterSensitiveLog: () => (/* binding */ ListAccountsRequestFilterSensitiveLog),
/* harmony export */   LogoutRequestFilterSensitiveLog: () => (/* binding */ LogoutRequestFilterSensitiveLog),
/* harmony export */   ResourceNotFoundException: () => (/* binding */ ResourceNotFoundException),
/* harmony export */   RoleCredentialsFilterSensitiveLog: () => (/* binding */ RoleCredentialsFilterSensitiveLog),
/* harmony export */   TooManyRequestsException: () => (/* binding */ TooManyRequestsException),
/* harmony export */   UnauthorizedException: () => (/* binding */ UnauthorizedException)
/* harmony export */ });
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3078);
/* harmony import */ var _SSOServiceException__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(4372);


class InvalidRequestException extends _SSOServiceException__WEBPACK_IMPORTED_MODULE_0__.SSOServiceException {
    name = "InvalidRequestException";
    $fault = "client";
    constructor(opts) {
        super({
            name: "InvalidRequestException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, InvalidRequestException.prototype);
    }
}
class ResourceNotFoundException extends _SSOServiceException__WEBPACK_IMPORTED_MODULE_0__.SSOServiceException {
    name = "ResourceNotFoundException";
    $fault = "client";
    constructor(opts) {
        super({
            name: "ResourceNotFoundException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, ResourceNotFoundException.prototype);
    }
}
class TooManyRequestsException extends _SSOServiceException__WEBPACK_IMPORTED_MODULE_0__.SSOServiceException {
    name = "TooManyRequestsException";
    $fault = "client";
    constructor(opts) {
        super({
            name: "TooManyRequestsException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, TooManyRequestsException.prototype);
    }
}
class UnauthorizedException extends _SSOServiceException__WEBPACK_IMPORTED_MODULE_0__.SSOServiceException {
    name = "UnauthorizedException";
    $fault = "client";
    constructor(opts) {
        super({
            name: "UnauthorizedException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, UnauthorizedException.prototype);
    }
}
const GetRoleCredentialsRequestFilterSensitiveLog = (obj) => ({
    ...obj,
    ...(obj.accessToken && { accessToken: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.SENSITIVE_STRING }),
});
const RoleCredentialsFilterSensitiveLog = (obj) => ({
    ...obj,
    ...(obj.secretAccessKey && { secretAccessKey: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.SENSITIVE_STRING }),
    ...(obj.sessionToken && { sessionToken: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.SENSITIVE_STRING }),
});
const GetRoleCredentialsResponseFilterSensitiveLog = (obj) => ({
    ...obj,
    ...(obj.roleCredentials && { roleCredentials: RoleCredentialsFilterSensitiveLog(obj.roleCredentials) }),
});
const ListAccountRolesRequestFilterSensitiveLog = (obj) => ({
    ...obj,
    ...(obj.accessToken && { accessToken: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.SENSITIVE_STRING }),
});
const ListAccountsRequestFilterSensitiveLog = (obj) => ({
    ...obj,
    ...(obj.accessToken && { accessToken: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.SENSITIVE_STRING }),
});
const LogoutRequestFilterSensitiveLog = (obj) => ({
    ...obj,
    ...(obj.accessToken && { accessToken: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.SENSITIVE_STRING }),
});


/***/ }),

/***/ 4373:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   de_GetRoleCredentialsCommand: () => (/* binding */ de_GetRoleCredentialsCommand),
/* harmony export */   de_ListAccountRolesCommand: () => (/* binding */ de_ListAccountRolesCommand),
/* harmony export */   de_ListAccountsCommand: () => (/* binding */ de_ListAccountsCommand),
/* harmony export */   de_LogoutCommand: () => (/* binding */ de_LogoutCommand),
/* harmony export */   se_GetRoleCredentialsCommand: () => (/* binding */ se_GetRoleCredentialsCommand),
/* harmony export */   se_ListAccountRolesCommand: () => (/* binding */ se_ListAccountRolesCommand),
/* harmony export */   se_ListAccountsCommand: () => (/* binding */ se_ListAccountsCommand),
/* harmony export */   se_LogoutCommand: () => (/* binding */ se_LogoutCommand)
/* harmony export */ });
/* harmony import */ var _aws_sdk_core__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(4374);
/* harmony import */ var _smithy_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3081);
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3084);
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(3085);
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(3087);
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(4375);
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(3097);
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(3118);
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(3077);
/* harmony import */ var _models_models_0__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(4371);
/* harmony import */ var _models_SSOServiceException__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(4372);





const se_GetRoleCredentialsCommand = async (input, context) => {
    const b = (0,_smithy_core__WEBPACK_IMPORTED_MODULE_0__.requestBuilder)(input, context);
    const headers = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.map)({}, _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_2__.isSerializableHeaderValue, {
        [_xasbt]: input[_aT],
    });
    b.bp("/federation/credentials");
    const query = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.map)({
        [_rn]: [, (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectNonNull)(input[_rN], `roleName`)],
        [_ai]: [, (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectNonNull)(input[_aI], `accountId`)],
    });
    let body;
    b.m("GET").h(headers).q(query).b(body);
    return b.build();
};
const se_ListAccountRolesCommand = async (input, context) => {
    const b = (0,_smithy_core__WEBPACK_IMPORTED_MODULE_0__.requestBuilder)(input, context);
    const headers = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.map)({}, _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_2__.isSerializableHeaderValue, {
        [_xasbt]: input[_aT],
    });
    b.bp("/assignment/roles");
    const query = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.map)({
        [_nt]: [, input[_nT]],
        [_mr]: [() => input.maxResults !== void 0, () => input[_mR].toString()],
        [_ai]: [, (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectNonNull)(input[_aI], `accountId`)],
    });
    let body;
    b.m("GET").h(headers).q(query).b(body);
    return b.build();
};
const se_ListAccountsCommand = async (input, context) => {
    const b = (0,_smithy_core__WEBPACK_IMPORTED_MODULE_0__.requestBuilder)(input, context);
    const headers = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.map)({}, _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_2__.isSerializableHeaderValue, {
        [_xasbt]: input[_aT],
    });
    b.bp("/assignment/accounts");
    const query = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.map)({
        [_nt]: [, input[_nT]],
        [_mr]: [() => input.maxResults !== void 0, () => input[_mR].toString()],
    });
    let body;
    b.m("GET").h(headers).q(query).b(body);
    return b.build();
};
const se_LogoutCommand = async (input, context) => {
    const b = (0,_smithy_core__WEBPACK_IMPORTED_MODULE_0__.requestBuilder)(input, context);
    const headers = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.map)({}, _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_2__.isSerializableHeaderValue, {
        [_xasbt]: input[_aT],
    });
    b.bp("/logout");
    let body;
    b.m("POST").h(headers).b(body);
    return b.build();
};
const de_GetRoleCredentialsCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectNonNull)((0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectObject)(await (0,_aws_sdk_core__WEBPACK_IMPORTED_MODULE_4__.parseJsonBody)(output.body, context)), "body");
    const doc = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.take)(data, {
        roleCredentials: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_5__._json,
    });
    Object.assign(contents, doc);
    return contents;
};
const de_ListAccountRolesCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectNonNull)((0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectObject)(await (0,_aws_sdk_core__WEBPACK_IMPORTED_MODULE_4__.parseJsonBody)(output.body, context)), "body");
    const doc = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.take)(data, {
        nextToken: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString,
        roleList: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_5__._json,
    });
    Object.assign(contents, doc);
    return contents;
};
const de_ListAccountsCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.map)({
        $metadata: deserializeMetadata(output),
    });
    const data = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectNonNull)((0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectObject)(await (0,_aws_sdk_core__WEBPACK_IMPORTED_MODULE_4__.parseJsonBody)(output.body, context)), "body");
    const doc = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.take)(data, {
        accountList: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_5__._json,
        nextToken: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString,
    });
    Object.assign(contents, doc);
    return contents;
};
const de_LogoutCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.map)({
        $metadata: deserializeMetadata(output),
    });
    await (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_6__.collectBody)(output.body, context);
    return contents;
};
const de_CommandError = async (output, context) => {
    const parsedOutput = {
        ...output,
        body: await (0,_aws_sdk_core__WEBPACK_IMPORTED_MODULE_4__.parseJsonErrorBody)(output.body, context),
    };
    const errorCode = (0,_aws_sdk_core__WEBPACK_IMPORTED_MODULE_4__.loadRestJsonErrorCode)(output, parsedOutput.body);
    switch (errorCode) {
        case "InvalidRequestException":
        case "com.amazonaws.sso#InvalidRequestException":
            throw await de_InvalidRequestExceptionRes(parsedOutput, context);
        case "ResourceNotFoundException":
        case "com.amazonaws.sso#ResourceNotFoundException":
            throw await de_ResourceNotFoundExceptionRes(parsedOutput, context);
        case "TooManyRequestsException":
        case "com.amazonaws.sso#TooManyRequestsException":
            throw await de_TooManyRequestsExceptionRes(parsedOutput, context);
        case "UnauthorizedException":
        case "com.amazonaws.sso#UnauthorizedException":
            throw await de_UnauthorizedExceptionRes(parsedOutput, context);
        default:
            const parsedBody = parsedOutput.body;
            return throwDefaultError({
                output,
                parsedBody,
                errorCode,
            });
    }
};
const throwDefaultError = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_7__.withBaseException)(_models_SSOServiceException__WEBPACK_IMPORTED_MODULE_8__.SSOServiceException);
const de_InvalidRequestExceptionRes = async (parsedOutput, context) => {
    const contents = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.map)({});
    const data = parsedOutput.body;
    const doc = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.take)(data, {
        message: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString,
    });
    Object.assign(contents, doc);
    const exception = new _models_models_0__WEBPACK_IMPORTED_MODULE_9__.InvalidRequestException({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents,
    });
    return (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_10__.decorateServiceException)(exception, parsedOutput.body);
};
const de_ResourceNotFoundExceptionRes = async (parsedOutput, context) => {
    const contents = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.map)({});
    const data = parsedOutput.body;
    const doc = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.take)(data, {
        message: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString,
    });
    Object.assign(contents, doc);
    const exception = new _models_models_0__WEBPACK_IMPORTED_MODULE_9__.ResourceNotFoundException({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents,
    });
    return (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_10__.decorateServiceException)(exception, parsedOutput.body);
};
const de_TooManyRequestsExceptionRes = async (parsedOutput, context) => {
    const contents = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.map)({});
    const data = parsedOutput.body;
    const doc = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.take)(data, {
        message: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString,
    });
    Object.assign(contents, doc);
    const exception = new _models_models_0__WEBPACK_IMPORTED_MODULE_9__.TooManyRequestsException({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents,
    });
    return (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_10__.decorateServiceException)(exception, parsedOutput.body);
};
const de_UnauthorizedExceptionRes = async (parsedOutput, context) => {
    const contents = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.map)({});
    const data = parsedOutput.body;
    const doc = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.take)(data, {
        message: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString,
    });
    Object.assign(contents, doc);
    const exception = new _models_models_0__WEBPACK_IMPORTED_MODULE_9__.UnauthorizedException({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents,
    });
    return (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_10__.decorateServiceException)(exception, parsedOutput.body);
};
const deserializeMetadata = (output) => ({
    httpStatusCode: output.statusCode,
    requestId: output.headers["x-amzn-requestid"] ?? output.headers["x-amzn-request-id"] ?? output.headers["x-amz-request-id"],
    extendedRequestId: output.headers["x-amz-id-2"],
    cfId: output.headers["x-amz-cf-id"],
});
const collectBodyString = (streamBody, context) => (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_6__.collectBody)(streamBody, context).then((body) => context.utf8Encoder(body));
const _aI = "accountId";
const _aT = "accessToken";
const _ai = "account_id";
const _mR = "maxResults";
const _mr = "max_result";
const _nT = "nextToken";
const _nt = "next_token";
const _rN = "roleName";
const _rn = "role_name";
const _xasbt = "x-amz-sso_bearer_token";


/***/ }),

/***/ 4378:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getRuntimeConfig: () => (/* binding */ getRuntimeConfig)
/* harmony export */ });
/* harmony import */ var _package_json__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(4379);
/* harmony import */ var _aws_sdk_core__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(3167);
/* harmony import */ var _aws_sdk_core__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(3168);
/* harmony import */ var _aws_sdk_util_user_agent_node__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(3175);
/* harmony import */ var _aws_sdk_util_user_agent_node__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(3233);
/* harmony import */ var _smithy_config_resolver__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(3165);
/* harmony import */ var _smithy_config_resolver__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(3231);
/* harmony import */ var _smithy_config_resolver__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(3232);
/* harmony import */ var _smithy_hash_node__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(3146);
/* harmony import */ var _smithy_middleware_retry__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(3205);
/* harmony import */ var _smithy_node_config_provider__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(3029);
/* harmony import */ var _smithy_node_http_handler__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(3218);
/* harmony import */ var _smithy_node_http_handler__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(3159);
/* harmony import */ var _smithy_util_body_length_node__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(3171);
/* harmony import */ var _smithy_util_retry__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(3206);
/* harmony import */ var _runtimeConfig_shared__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(4380);
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(3166);
/* harmony import */ var _smithy_util_defaults_mode_node__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3162);
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3161);














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

/***/ 4380:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getRuntimeConfig: () => (/* binding */ getRuntimeConfig)
/* harmony export */ });
/* harmony import */ var _aws_sdk_core__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(3149);
/* harmony import */ var _smithy_core__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(4383);
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(3155);
/* harmony import */ var _smithy_url_parser__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(2974);
/* harmony import */ var _smithy_util_base64__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3102);
/* harmony import */ var _smithy_util_base64__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3100);
/* harmony import */ var _smithy_util_utf8__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(3055);
/* harmony import */ var _smithy_util_utf8__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(3101);
/* harmony import */ var _auth_httpAuthSchemeProvider__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(4377);
/* harmony import */ var _endpoint_endpointResolver__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(4381);








const getRuntimeConfig = (config) => {
    return {
        apiVersion: "2019-06-10",
        base64Decoder: config?.base64Decoder ?? _smithy_util_base64__WEBPACK_IMPORTED_MODULE_0__.fromBase64,
        base64Encoder: config?.base64Encoder ?? _smithy_util_base64__WEBPACK_IMPORTED_MODULE_1__.toBase64,
        disableHostPrefix: config?.disableHostPrefix ?? false,
        endpointProvider: config?.endpointProvider ?? _endpoint_endpointResolver__WEBPACK_IMPORTED_MODULE_2__.defaultEndpointResolver,
        extensions: config?.extensions ?? [],
        httpAuthSchemeProvider: config?.httpAuthSchemeProvider ?? _auth_httpAuthSchemeProvider__WEBPACK_IMPORTED_MODULE_3__.defaultSSOHttpAuthSchemeProvider,
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
        serviceId: config?.serviceId ?? "SSO",
        urlParser: config?.urlParser ?? _smithy_url_parser__WEBPACK_IMPORTED_MODULE_7__.parseUrl,
        utf8Decoder: config?.utf8Decoder ?? _smithy_util_utf8__WEBPACK_IMPORTED_MODULE_8__.fromUtf8,
        utf8Encoder: config?.utf8Encoder ?? _smithy_util_utf8__WEBPACK_IMPORTED_MODULE_9__.toUtf8,
    };
};


/***/ }),

/***/ 4384:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   resolveRuntimeExtensions: () => (/* binding */ resolveRuntimeExtensions)
/* harmony export */ });
/* harmony import */ var _aws_sdk_region_config_resolver__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3237);
/* harmony import */ var _smithy_protocol_http__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(3242);
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3238);
/* harmony import */ var _auth_httpAuthExtensionConfiguration__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(4385);




const resolveRuntimeExtensions = (runtimeConfig, extensions) => {
    const extensionConfiguration = Object.assign((0,_aws_sdk_region_config_resolver__WEBPACK_IMPORTED_MODULE_0__.getAwsRegionExtensionConfiguration)(runtimeConfig), (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.getDefaultExtensionConfiguration)(runtimeConfig), (0,_smithy_protocol_http__WEBPACK_IMPORTED_MODULE_2__.getHttpHandlerExtensionConfiguration)(runtimeConfig), (0,_auth_httpAuthExtensionConfiguration__WEBPACK_IMPORTED_MODULE_3__.getHttpAuthExtensionConfiguration)(runtimeConfig));
    extensions.forEach((extension) => extension.configure(extensionConfiguration));
    return Object.assign(runtimeConfig, (0,_aws_sdk_region_config_resolver__WEBPACK_IMPORTED_MODULE_0__.resolveAwsRegionExtensionConfiguration)(extensionConfiguration), (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__.resolveDefaultRuntimeConfig)(extensionConfiguration), (0,_smithy_protocol_http__WEBPACK_IMPORTED_MODULE_2__.resolveHttpHandlerRuntimeConfig)(extensionConfiguration), (0,_auth_httpAuthExtensionConfiguration__WEBPACK_IMPORTED_MODULE_3__.resolveHttpAuthRuntimeConfig)(extensionConfiguration));
};


/***/ }),

/***/ 4374:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   loadRestJsonErrorCode: () => (/* binding */ loadRestJsonErrorCode),
/* harmony export */   parseJsonBody: () => (/* binding */ parseJsonBody),
/* harmony export */   parseJsonErrorBody: () => (/* binding */ parseJsonErrorBody)
/* harmony export */ });
/* harmony import */ var _common__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3104);

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

/***/ 4368:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   GetRoleCredentialsCommand: () => (/* reexport safe */ _aws_sdk_client_sso__WEBPACK_IMPORTED_MODULE_0__.GetRoleCredentialsCommand),
/* harmony export */   SSOClient: () => (/* reexport safe */ _aws_sdk_client_sso__WEBPACK_IMPORTED_MODULE_1__.SSOClient)
/* harmony export */ });
/* harmony import */ var _aws_sdk_client_sso__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(4369);
/* harmony import */ var _aws_sdk_client_sso__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(4376);




/***/ }),

/***/ 4383:
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

/***/ 4375:
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

/***/ 4379:
/***/ ((module) => {

module.exports = /*#__PURE__*/JSON.parse('{"name":"@aws-sdk/client-sso","description":"AWS SDK for JavaScript Sso Client for Node.js, Browser and React Native","version":"3.901.0","scripts":{"build":"concurrently \'yarn:build:cjs\' \'yarn:build:es\' \'yarn:build:types\'","build:cjs":"node ../../scripts/compilation/inline client-sso","build:es":"tsc -p tsconfig.es.json","build:include:deps":"lerna run --scope $npm_package_name --include-dependencies build","build:types":"tsc -p tsconfig.types.json","build:types:downlevel":"downlevel-dts dist-types dist-types/ts3.4","clean":"rimraf ./dist-* && rimraf *.tsbuildinfo","extract:docs":"api-extractor run --local","generate:client":"node ../../scripts/generate-clients/single-service --solo sso"},"main":"./dist-cjs/index.js","types":"./dist-types/index.d.ts","module":"./dist-es/index.js","sideEffects":false,"dependencies":{"@aws-crypto/sha256-browser":"5.2.0","@aws-crypto/sha256-js":"5.2.0","@aws-sdk/core":"3.901.0","@aws-sdk/middleware-host-header":"3.901.0","@aws-sdk/middleware-logger":"3.901.0","@aws-sdk/middleware-recursion-detection":"3.901.0","@aws-sdk/middleware-user-agent":"3.901.0","@aws-sdk/region-config-resolver":"3.901.0","@aws-sdk/types":"3.901.0","@aws-sdk/util-endpoints":"3.901.0","@aws-sdk/util-user-agent-browser":"3.901.0","@aws-sdk/util-user-agent-node":"3.901.0","@smithy/config-resolver":"^4.3.0","@smithy/core":"^3.14.0","@smithy/fetch-http-handler":"^5.3.0","@smithy/hash-node":"^4.2.0","@smithy/invalid-dependency":"^4.2.0","@smithy/middleware-content-length":"^4.2.0","@smithy/middleware-endpoint":"^4.3.0","@smithy/middleware-retry":"^4.4.0","@smithy/middleware-serde":"^4.2.0","@smithy/middleware-stack":"^4.2.0","@smithy/node-config-provider":"^4.3.0","@smithy/node-http-handler":"^4.3.0","@smithy/protocol-http":"^5.3.0","@smithy/smithy-client":"^4.7.0","@smithy/types":"^4.6.0","@smithy/url-parser":"^4.2.0","@smithy/util-base64":"^4.2.0","@smithy/util-body-length-browser":"^4.2.0","@smithy/util-body-length-node":"^4.2.0","@smithy/util-defaults-mode-browser":"^4.2.0","@smithy/util-defaults-mode-node":"^4.2.0","@smithy/util-endpoints":"^3.2.0","@smithy/util-middleware":"^4.2.0","@smithy/util-retry":"^4.2.0","@smithy/util-utf8":"^4.2.0","tslib":"^2.6.2"},"devDependencies":{"@tsconfig/node18":"18.2.4","@types/node":"^18.19.69","concurrently":"7.0.0","downlevel-dts":"0.10.1","rimraf":"3.0.2","typescript":"~5.8.3"},"engines":{"node":">=18.0.0"},"typesVersions":{"<4.0":{"dist-types/*":["dist-types/ts3.4/*"]}},"files":["dist-*/**"],"author":{"name":"AWS SDK for JavaScript Team","url":"https://aws.amazon.com/javascript/"},"license":"Apache-2.0","browser":{"./dist-es/runtimeConfig":"./dist-es/runtimeConfig.browser"},"react-native":{"./dist-es/runtimeConfig":"./dist-es/runtimeConfig.native"},"homepage":"https://github.com/aws/aws-sdk-js-v3/tree/main/clients/client-sso","repository":{"type":"git","url":"https://github.com/aws/aws-sdk-js-v3.git","directory":"clients/client-sso"}}');

/***/ })

};
;