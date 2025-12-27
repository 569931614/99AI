"use strict";
exports.id = 11;
exports.ids = [11];
exports.modules = {

/***/ 4533:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   STS: () => (/* binding */ STS)
/* harmony export */ });
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(3468);
/* harmony import */ var _commands_AssumeRoleCommand__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(4534);
/* harmony import */ var _commands_AssumeRoleWithWebIdentityCommand__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(4538);
/* harmony import */ var _STSClient__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(4524);




const commands = {
    AssumeRoleCommand: _commands_AssumeRoleCommand__WEBPACK_IMPORTED_MODULE_0__.AssumeRoleCommand,
    AssumeRoleWithWebIdentityCommand: _commands_AssumeRoleWithWebIdentityCommand__WEBPACK_IMPORTED_MODULE_1__.AssumeRoleWithWebIdentityCommand,
};
class STS extends _STSClient__WEBPACK_IMPORTED_MODULE_2__.STSClient {
}
(0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.createAggregatedClient)(commands, STS);


/***/ }),

/***/ 4524:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   STSClient: () => (/* binding */ STSClient),
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
/* harmony import */ var _auth_httpAuthSchemeProvider__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(4525);
/* harmony import */ var _endpoint_EndpointParameters__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(4526);
/* harmony import */ var _runtimeConfig__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(4527);
/* harmony import */ var _runtimeExtensions__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(4531);















class STSClient extends _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_0__.Client {
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
            httpAuthSchemeParametersProvider: _auth_httpAuthSchemeProvider__WEBPACK_IMPORTED_MODULE_8__.defaultSTSHttpAuthSchemeParametersProvider,
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

/***/ 4532:
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

/***/ 4525:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   defaultSTSHttpAuthSchemeParametersProvider: () => (/* binding */ defaultSTSHttpAuthSchemeParametersProvider),
/* harmony export */   defaultSTSHttpAuthSchemeProvider: () => (/* binding */ defaultSTSHttpAuthSchemeProvider),
/* harmony export */   resolveHttpAuthSchemeConfig: () => (/* binding */ resolveHttpAuthSchemeConfig),
/* harmony export */   resolveStsAuthConfig: () => (/* binding */ resolveStsAuthConfig)
/* harmony export */ });
/* harmony import */ var _aws_sdk_core__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(3120);
/* harmony import */ var _smithy_util_middleware__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3067);
/* harmony import */ var _smithy_util_middleware__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3094);
/* harmony import */ var _STSClient__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(4524);



const defaultSTSHttpAuthSchemeParametersProvider = async (config, context, input) => {
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
            name: "sts",
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
const defaultSTSHttpAuthSchemeProvider = (authParameters) => {
    const options = [];
    switch (authParameters.operation) {
        case "AssumeRoleWithWebIdentity": {
            options.push(createSmithyApiNoAuthHttpAuthOption(authParameters));
            break;
        }
        default: {
            options.push(createAwsAuthSigv4HttpAuthOption(authParameters));
        }
    }
    return options;
};
const resolveStsAuthConfig = (input) => Object.assign(input, {
    stsClientCtor: _STSClient__WEBPACK_IMPORTED_MODULE_2__.STSClient,
});
const resolveHttpAuthSchemeConfig = (config) => {
    const config_0 = resolveStsAuthConfig(config);
    const config_1 = (0,_aws_sdk_core__WEBPACK_IMPORTED_MODULE_3__.resolveAwsSdkSigV4Config)(config_0);
    return Object.assign(config_1, {
        authSchemePreference: (0,_smithy_util_middleware__WEBPACK_IMPORTED_MODULE_1__.normalizeProvider)(config.authSchemePreference ?? []),
    });
};


/***/ }),

/***/ 4534:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   $Command: () => (/* reexport safe */ _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_0__.Command),
/* harmony export */   AssumeRoleCommand: () => (/* binding */ AssumeRoleCommand)
/* harmony export */ });
/* harmony import */ var _smithy_middleware_endpoint__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(3187);
/* harmony import */ var _smithy_middleware_serde__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(3183);
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3171);
/* harmony import */ var _endpoint_EndpointParameters__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(4526);
/* harmony import */ var _models_models_0__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(4535);
/* harmony import */ var _protocols_Aws_query__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(4537);







class AssumeRoleCommand extends _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_0__.Command
    .classBuilder()
    .ep(_endpoint_EndpointParameters__WEBPACK_IMPORTED_MODULE_1__.commonParams)
    .m(function (Command, cs, config, o) {
    return [
        (0,_smithy_middleware_serde__WEBPACK_IMPORTED_MODULE_2__.getSerdePlugin)(config, this.serialize, this.deserialize),
        (0,_smithy_middleware_endpoint__WEBPACK_IMPORTED_MODULE_3__.getEndpointPlugin)(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("AWSSecurityTokenServiceV20110615", "AssumeRole", {})
    .n("STSClient", "AssumeRoleCommand")
    .f(void 0, _models_models_0__WEBPACK_IMPORTED_MODULE_4__.AssumeRoleResponseFilterSensitiveLog)
    .ser(_protocols_Aws_query__WEBPACK_IMPORTED_MODULE_5__.se_AssumeRoleCommand)
    .de(_protocols_Aws_query__WEBPACK_IMPORTED_MODULE_5__.de_AssumeRoleCommand)
    .build() {
}


/***/ }),

/***/ 4538:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   $Command: () => (/* reexport safe */ _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_0__.Command),
/* harmony export */   AssumeRoleWithWebIdentityCommand: () => (/* binding */ AssumeRoleWithWebIdentityCommand)
/* harmony export */ });
/* harmony import */ var _smithy_middleware_endpoint__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(3187);
/* harmony import */ var _smithy_middleware_serde__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(3183);
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3171);
/* harmony import */ var _endpoint_EndpointParameters__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(4526);
/* harmony import */ var _models_models_0__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(4535);
/* harmony import */ var _protocols_Aws_query__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(4537);







class AssumeRoleWithWebIdentityCommand extends _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_0__.Command
    .classBuilder()
    .ep(_endpoint_EndpointParameters__WEBPACK_IMPORTED_MODULE_1__.commonParams)
    .m(function (Command, cs, config, o) {
    return [
        (0,_smithy_middleware_serde__WEBPACK_IMPORTED_MODULE_2__.getSerdePlugin)(config, this.serialize, this.deserialize),
        (0,_smithy_middleware_endpoint__WEBPACK_IMPORTED_MODULE_3__.getEndpointPlugin)(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("AWSSecurityTokenServiceV20110615", "AssumeRoleWithWebIdentity", {})
    .n("STSClient", "AssumeRoleWithWebIdentityCommand")
    .f(_models_models_0__WEBPACK_IMPORTED_MODULE_4__.AssumeRoleWithWebIdentityRequestFilterSensitiveLog, _models_models_0__WEBPACK_IMPORTED_MODULE_4__.AssumeRoleWithWebIdentityResponseFilterSensitiveLog)
    .ser(_protocols_Aws_query__WEBPACK_IMPORTED_MODULE_5__.se_AssumeRoleWithWebIdentityCommand)
    .de(_protocols_Aws_query__WEBPACK_IMPORTED_MODULE_5__.de_AssumeRoleWithWebIdentityCommand)
    .build() {
}


/***/ }),

/***/ 4539:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   $Command: () => (/* reexport safe */ _AssumeRoleCommand__WEBPACK_IMPORTED_MODULE_0__.$Command),
/* harmony export */   AssumeRoleCommand: () => (/* reexport safe */ _AssumeRoleCommand__WEBPACK_IMPORTED_MODULE_0__.AssumeRoleCommand),
/* harmony export */   AssumeRoleWithWebIdentityCommand: () => (/* reexport safe */ _AssumeRoleWithWebIdentityCommand__WEBPACK_IMPORTED_MODULE_1__.AssumeRoleWithWebIdentityCommand)
/* harmony export */ });
/* harmony import */ var _AssumeRoleCommand__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(4534);
/* harmony import */ var _AssumeRoleWithWebIdentityCommand__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(4538);




/***/ }),

/***/ 4541:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   decorateDefaultCredentialProvider: () => (/* binding */ decorateDefaultCredentialProvider),
/* harmony export */   getDefaultRoleAssumer: () => (/* binding */ getDefaultRoleAssumer),
/* harmony export */   getDefaultRoleAssumerWithWebIdentity: () => (/* binding */ getDefaultRoleAssumerWithWebIdentity)
/* harmony export */ });
/* harmony import */ var _defaultStsRoleAssumers__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(4542);
/* harmony import */ var _STSClient__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(4524);


const getCustomizableStsClientCtor = (baseCtor, customizations) => {
    if (!customizations)
        return baseCtor;
    else
        return class CustomizableSTSClient extends baseCtor {
            constructor(config) {
                super(config);
                for (const customization of customizations) {
                    this.middlewareStack.use(customization);
                }
            }
        };
};
const getDefaultRoleAssumer = (stsOptions = {}, stsPlugins) => (0,_defaultStsRoleAssumers__WEBPACK_IMPORTED_MODULE_0__.getDefaultRoleAssumer)(stsOptions, getCustomizableStsClientCtor(_STSClient__WEBPACK_IMPORTED_MODULE_1__.STSClient, stsPlugins));
const getDefaultRoleAssumerWithWebIdentity = (stsOptions = {}, stsPlugins) => (0,_defaultStsRoleAssumers__WEBPACK_IMPORTED_MODULE_0__.getDefaultRoleAssumerWithWebIdentity)(stsOptions, getCustomizableStsClientCtor(_STSClient__WEBPACK_IMPORTED_MODULE_1__.STSClient, stsPlugins));
const decorateDefaultCredentialProvider = (provider) => (input) => provider({
    roleAssumer: getDefaultRoleAssumer(input),
    roleAssumerWithWebIdentity: getDefaultRoleAssumerWithWebIdentity(input),
    ...input,
});


/***/ }),

/***/ 4542:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   decorateDefaultCredentialProvider: () => (/* binding */ decorateDefaultCredentialProvider),
/* harmony export */   getDefaultRoleAssumer: () => (/* binding */ getDefaultRoleAssumer),
/* harmony export */   getDefaultRoleAssumerWithWebIdentity: () => (/* binding */ getDefaultRoleAssumerWithWebIdentity)
/* harmony export */ });
/* harmony import */ var _aws_sdk_core_client__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3121);
/* harmony import */ var _commands_AssumeRoleCommand__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(4534);
/* harmony import */ var _commands_AssumeRoleWithWebIdentityCommand__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(4538);



const ASSUME_ROLE_DEFAULT_REGION = "us-east-1";
const getAccountIdFromAssumedRoleUser = (assumedRoleUser) => {
    if (typeof assumedRoleUser?.Arn === "string") {
        const arnComponents = assumedRoleUser.Arn.split(":");
        if (arnComponents.length > 4 && arnComponents[4] !== "") {
            return arnComponents[4];
        }
    }
    return undefined;
};
const resolveRegion = async (_region, _parentRegion, credentialProviderLogger) => {
    const region = typeof _region === "function" ? await _region() : _region;
    const parentRegion = typeof _parentRegion === "function" ? await _parentRegion() : _parentRegion;
    credentialProviderLogger?.debug?.("@aws-sdk/client-sts::resolveRegion", "accepting first of:", `${region} (provider)`, `${parentRegion} (parent client)`, `${ASSUME_ROLE_DEFAULT_REGION} (STS default)`);
    return region ?? parentRegion ?? ASSUME_ROLE_DEFAULT_REGION;
};
const getDefaultRoleAssumer = (stsOptions, STSClient) => {
    let stsClient;
    let closureSourceCreds;
    return async (sourceCreds, params) => {
        closureSourceCreds = sourceCreds;
        if (!stsClient) {
            const { logger = stsOptions?.parentClientConfig?.logger, region, requestHandler = stsOptions?.parentClientConfig?.requestHandler, credentialProviderLogger, } = stsOptions;
            const resolvedRegion = await resolveRegion(region, stsOptions?.parentClientConfig?.region, credentialProviderLogger);
            const isCompatibleRequestHandler = !isH2(requestHandler);
            stsClient = new STSClient({
                profile: stsOptions?.parentClientConfig?.profile,
                credentialDefaultProvider: () => async () => closureSourceCreds,
                region: resolvedRegion,
                requestHandler: isCompatibleRequestHandler ? requestHandler : undefined,
                logger: logger,
            });
        }
        const { Credentials, AssumedRoleUser } = await stsClient.send(new _commands_AssumeRoleCommand__WEBPACK_IMPORTED_MODULE_0__.AssumeRoleCommand(params));
        if (!Credentials || !Credentials.AccessKeyId || !Credentials.SecretAccessKey) {
            throw new Error(`Invalid response from STS.assumeRole call with role ${params.RoleArn}`);
        }
        const accountId = getAccountIdFromAssumedRoleUser(AssumedRoleUser);
        const credentials = {
            accessKeyId: Credentials.AccessKeyId,
            secretAccessKey: Credentials.SecretAccessKey,
            sessionToken: Credentials.SessionToken,
            expiration: Credentials.Expiration,
            ...(Credentials.CredentialScope && { credentialScope: Credentials.CredentialScope }),
            ...(accountId && { accountId }),
        };
        (0,_aws_sdk_core_client__WEBPACK_IMPORTED_MODULE_1__.setCredentialFeature)(credentials, "CREDENTIALS_STS_ASSUME_ROLE", "i");
        return credentials;
    };
};
const getDefaultRoleAssumerWithWebIdentity = (stsOptions, STSClient) => {
    let stsClient;
    return async (params) => {
        if (!stsClient) {
            const { logger = stsOptions?.parentClientConfig?.logger, region, requestHandler = stsOptions?.parentClientConfig?.requestHandler, credentialProviderLogger, } = stsOptions;
            const resolvedRegion = await resolveRegion(region, stsOptions?.parentClientConfig?.region, credentialProviderLogger);
            const isCompatibleRequestHandler = !isH2(requestHandler);
            stsClient = new STSClient({
                profile: stsOptions?.parentClientConfig?.profile,
                region: resolvedRegion,
                requestHandler: isCompatibleRequestHandler ? requestHandler : undefined,
                logger: logger,
            });
        }
        const { Credentials, AssumedRoleUser } = await stsClient.send(new _commands_AssumeRoleWithWebIdentityCommand__WEBPACK_IMPORTED_MODULE_2__.AssumeRoleWithWebIdentityCommand(params));
        if (!Credentials || !Credentials.AccessKeyId || !Credentials.SecretAccessKey) {
            throw new Error(`Invalid response from STS.assumeRoleWithWebIdentity call with role ${params.RoleArn}`);
        }
        const accountId = getAccountIdFromAssumedRoleUser(AssumedRoleUser);
        const credentials = {
            accessKeyId: Credentials.AccessKeyId,
            secretAccessKey: Credentials.SecretAccessKey,
            sessionToken: Credentials.SessionToken,
            expiration: Credentials.Expiration,
            ...(Credentials.CredentialScope && { credentialScope: Credentials.CredentialScope }),
            ...(accountId && { accountId }),
        };
        if (accountId) {
            (0,_aws_sdk_core_client__WEBPACK_IMPORTED_MODULE_1__.setCredentialFeature)(credentials, "RESOLVED_ACCOUNT_ID", "T");
        }
        (0,_aws_sdk_core_client__WEBPACK_IMPORTED_MODULE_1__.setCredentialFeature)(credentials, "CREDENTIALS_STS_ASSUME_ROLE_WEB_ID", "k");
        return credentials;
    };
};
const decorateDefaultCredentialProvider = (provider) => (input) => provider({
    roleAssumer: getDefaultRoleAssumer(input, input.stsClientCtor),
    roleAssumerWithWebIdentity: getDefaultRoleAssumerWithWebIdentity(input, input.stsClientCtor),
    ...input,
});
const isH2 = (requestHandler) => {
    return requestHandler?.metadata?.handlerProtocol === "h2";
};


/***/ }),

/***/ 4526:
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
        useGlobalEndpoint: options.useGlobalEndpoint ?? false,
        defaultSigningName: "sts",
    });
};
const commonParams = {
    UseGlobalEndpoint: { type: "builtInParams", name: "useGlobalEndpoint" },
    UseFIPS: { type: "builtInParams", name: "useFipsEndpoint" },
    Endpoint: { type: "builtInParams", name: "endpoint" },
    Region: { type: "builtInParams", name: "region" },
    UseDualStack: { type: "builtInParams", name: "useDualstackEndpoint" },
};


/***/ }),

/***/ 4529:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   defaultEndpointResolver: () => (/* binding */ defaultEndpointResolver)
/* harmony export */ });
/* harmony import */ var _aws_sdk_util_endpoints__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3015);
/* harmony import */ var _smithy_util_endpoints__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3066);
/* harmony import */ var _smithy_util_endpoints__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(3029);
/* harmony import */ var _smithy_util_endpoints__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(3024);
/* harmony import */ var _ruleset__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(4530);



const cache = new _smithy_util_endpoints__WEBPACK_IMPORTED_MODULE_1__.EndpointCache({
    size: 50,
    params: ["Endpoint", "Region", "UseDualStack", "UseFIPS", "UseGlobalEndpoint"],
});
const defaultEndpointResolver = (endpointParams, context = {}) => {
    return cache.get(endpointParams, () => (0,_smithy_util_endpoints__WEBPACK_IMPORTED_MODULE_2__.resolveEndpoint)(_ruleset__WEBPACK_IMPORTED_MODULE_3__.ruleSet, {
        endpointParams: endpointParams,
        logger: context.logger,
    }));
};
_smithy_util_endpoints__WEBPACK_IMPORTED_MODULE_4__.customEndpointFunctions.aws = _aws_sdk_util_endpoints__WEBPACK_IMPORTED_MODULE_0__.awsEndpointFunctions;


/***/ }),

/***/ 4530:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ruleSet: () => (/* binding */ ruleSet)
/* harmony export */ });
const F = "required", G = "type", H = "fn", I = "argv", J = "ref";
const a = false, b = true, c = "booleanEquals", d = "stringEquals", e = "sigv4", f = "sts", g = "us-east-1", h = "endpoint", i = "https://sts.{Region}.{PartitionResult#dnsSuffix}", j = "tree", k = "error", l = "getAttr", m = { [F]: false, [G]: "String" }, n = { [F]: true, "default": false, [G]: "Boolean" }, o = { [J]: "Endpoint" }, p = { [H]: "isSet", [I]: [{ [J]: "Region" }] }, q = { [J]: "Region" }, r = { [H]: "aws.partition", [I]: [q], "assign": "PartitionResult" }, s = { [J]: "UseFIPS" }, t = { [J]: "UseDualStack" }, u = { "url": "https://sts.amazonaws.com", "properties": { "authSchemes": [{ "name": e, "signingName": f, "signingRegion": g }] }, "headers": {} }, v = {}, w = { "conditions": [{ [H]: d, [I]: [q, "aws-global"] }], [h]: u, [G]: h }, x = { [H]: c, [I]: [s, true] }, y = { [H]: c, [I]: [t, true] }, z = { [H]: l, [I]: [{ [J]: "PartitionResult" }, "supportsFIPS"] }, A = { [J]: "PartitionResult" }, B = { [H]: c, [I]: [true, { [H]: l, [I]: [A, "supportsDualStack"] }] }, C = [{ [H]: "isSet", [I]: [o] }], D = [x], E = [y];
const _data = { version: "1.0", parameters: { Region: m, UseDualStack: n, UseFIPS: n, Endpoint: m, UseGlobalEndpoint: n }, rules: [{ conditions: [{ [H]: c, [I]: [{ [J]: "UseGlobalEndpoint" }, b] }, { [H]: "not", [I]: C }, p, r, { [H]: c, [I]: [s, a] }, { [H]: c, [I]: [t, a] }], rules: [{ conditions: [{ [H]: d, [I]: [q, "ap-northeast-1"] }], endpoint: u, [G]: h }, { conditions: [{ [H]: d, [I]: [q, "ap-south-1"] }], endpoint: u, [G]: h }, { conditions: [{ [H]: d, [I]: [q, "ap-southeast-1"] }], endpoint: u, [G]: h }, { conditions: [{ [H]: d, [I]: [q, "ap-southeast-2"] }], endpoint: u, [G]: h }, w, { conditions: [{ [H]: d, [I]: [q, "ca-central-1"] }], endpoint: u, [G]: h }, { conditions: [{ [H]: d, [I]: [q, "eu-central-1"] }], endpoint: u, [G]: h }, { conditions: [{ [H]: d, [I]: [q, "eu-north-1"] }], endpoint: u, [G]: h }, { conditions: [{ [H]: d, [I]: [q, "eu-west-1"] }], endpoint: u, [G]: h }, { conditions: [{ [H]: d, [I]: [q, "eu-west-2"] }], endpoint: u, [G]: h }, { conditions: [{ [H]: d, [I]: [q, "eu-west-3"] }], endpoint: u, [G]: h }, { conditions: [{ [H]: d, [I]: [q, "sa-east-1"] }], endpoint: u, [G]: h }, { conditions: [{ [H]: d, [I]: [q, g] }], endpoint: u, [G]: h }, { conditions: [{ [H]: d, [I]: [q, "us-east-2"] }], endpoint: u, [G]: h }, { conditions: [{ [H]: d, [I]: [q, "us-west-1"] }], endpoint: u, [G]: h }, { conditions: [{ [H]: d, [I]: [q, "us-west-2"] }], endpoint: u, [G]: h }, { endpoint: { url: i, properties: { authSchemes: [{ name: e, signingName: f, signingRegion: "{Region}" }] }, headers: v }, [G]: h }], [G]: j }, { conditions: C, rules: [{ conditions: D, error: "Invalid Configuration: FIPS and custom endpoint are not supported", [G]: k }, { conditions: E, error: "Invalid Configuration: Dualstack and custom endpoint are not supported", [G]: k }, { endpoint: { url: o, properties: v, headers: v }, [G]: h }], [G]: j }, { conditions: [p], rules: [{ conditions: [r], rules: [{ conditions: [x, y], rules: [{ conditions: [{ [H]: c, [I]: [b, z] }, B], rules: [{ endpoint: { url: "https://sts-fips.{Region}.{PartitionResult#dualStackDnsSuffix}", properties: v, headers: v }, [G]: h }], [G]: j }, { error: "FIPS and DualStack are enabled, but this partition does not support one or both", [G]: k }], [G]: j }, { conditions: D, rules: [{ conditions: [{ [H]: c, [I]: [z, b] }], rules: [{ conditions: [{ [H]: d, [I]: [{ [H]: l, [I]: [A, "name"] }, "aws-us-gov"] }], endpoint: { url: "https://sts.{Region}.amazonaws.com", properties: v, headers: v }, [G]: h }, { endpoint: { url: "https://sts-fips.{Region}.{PartitionResult#dnsSuffix}", properties: v, headers: v }, [G]: h }], [G]: j }, { error: "FIPS is enabled but this partition does not support FIPS", [G]: k }], [G]: j }, { conditions: E, rules: [{ conditions: [B], rules: [{ endpoint: { url: "https://sts.{Region}.{PartitionResult#dualStackDnsSuffix}", properties: v, headers: v }, [G]: h }], [G]: j }, { error: "DualStack is enabled but this partition does not support DualStack", [G]: k }], [G]: j }, w, { endpoint: { url: i, properties: v, headers: v }, [G]: h }], [G]: j }], [G]: j }, { error: "Invalid Configuration: Missing Region", [G]: k }] };
const ruleSet = _data;


/***/ }),

/***/ 4523:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   $Command: () => (/* reexport safe */ _commands__WEBPACK_IMPORTED_MODULE_2__.$Command),
/* harmony export */   AssumeRoleCommand: () => (/* reexport safe */ _commands__WEBPACK_IMPORTED_MODULE_2__.AssumeRoleCommand),
/* harmony export */   AssumeRoleResponseFilterSensitiveLog: () => (/* reexport safe */ _models__WEBPACK_IMPORTED_MODULE_3__.AssumeRoleResponseFilterSensitiveLog),
/* harmony export */   AssumeRoleWithWebIdentityCommand: () => (/* reexport safe */ _commands__WEBPACK_IMPORTED_MODULE_2__.AssumeRoleWithWebIdentityCommand),
/* harmony export */   AssumeRoleWithWebIdentityRequestFilterSensitiveLog: () => (/* reexport safe */ _models__WEBPACK_IMPORTED_MODULE_3__.AssumeRoleWithWebIdentityRequestFilterSensitiveLog),
/* harmony export */   AssumeRoleWithWebIdentityResponseFilterSensitiveLog: () => (/* reexport safe */ _models__WEBPACK_IMPORTED_MODULE_3__.AssumeRoleWithWebIdentityResponseFilterSensitiveLog),
/* harmony export */   CredentialsFilterSensitiveLog: () => (/* reexport safe */ _models__WEBPACK_IMPORTED_MODULE_3__.CredentialsFilterSensitiveLog),
/* harmony export */   ExpiredTokenException: () => (/* reexport safe */ _models__WEBPACK_IMPORTED_MODULE_3__.ExpiredTokenException),
/* harmony export */   IDPCommunicationErrorException: () => (/* reexport safe */ _models__WEBPACK_IMPORTED_MODULE_3__.IDPCommunicationErrorException),
/* harmony export */   IDPRejectedClaimException: () => (/* reexport safe */ _models__WEBPACK_IMPORTED_MODULE_3__.IDPRejectedClaimException),
/* harmony export */   InvalidIdentityTokenException: () => (/* reexport safe */ _models__WEBPACK_IMPORTED_MODULE_3__.InvalidIdentityTokenException),
/* harmony export */   MalformedPolicyDocumentException: () => (/* reexport safe */ _models__WEBPACK_IMPORTED_MODULE_3__.MalformedPolicyDocumentException),
/* harmony export */   PackedPolicyTooLargeException: () => (/* reexport safe */ _models__WEBPACK_IMPORTED_MODULE_3__.PackedPolicyTooLargeException),
/* harmony export */   RegionDisabledException: () => (/* reexport safe */ _models__WEBPACK_IMPORTED_MODULE_3__.RegionDisabledException),
/* harmony export */   STS: () => (/* reexport safe */ _STS__WEBPACK_IMPORTED_MODULE_1__.STS),
/* harmony export */   STSClient: () => (/* reexport safe */ _STSClient__WEBPACK_IMPORTED_MODULE_0__.STSClient),
/* harmony export */   STSServiceException: () => (/* reexport safe */ _models_STSServiceException__WEBPACK_IMPORTED_MODULE_5__.STSServiceException),
/* harmony export */   __Client: () => (/* reexport safe */ _STSClient__WEBPACK_IMPORTED_MODULE_0__.__Client),
/* harmony export */   decorateDefaultCredentialProvider: () => (/* reexport safe */ _defaultRoleAssumers__WEBPACK_IMPORTED_MODULE_4__.decorateDefaultCredentialProvider),
/* harmony export */   getDefaultRoleAssumer: () => (/* reexport safe */ _defaultRoleAssumers__WEBPACK_IMPORTED_MODULE_4__.getDefaultRoleAssumer),
/* harmony export */   getDefaultRoleAssumerWithWebIdentity: () => (/* reexport safe */ _defaultRoleAssumers__WEBPACK_IMPORTED_MODULE_4__.getDefaultRoleAssumerWithWebIdentity)
/* harmony export */ });
/* harmony import */ var _STSClient__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(4524);
/* harmony import */ var _STS__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(4533);
/* harmony import */ var _commands__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(4539);
/* harmony import */ var _models__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(4540);
/* harmony import */ var _defaultRoleAssumers__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(4541);
/* harmony import */ var _models_STSServiceException__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(4536);








/***/ }),

/***/ 4536:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   STSServiceException: () => (/* binding */ STSServiceException),
/* harmony export */   __ServiceException: () => (/* reexport safe */ _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_0__.ServiceException)
/* harmony export */ });
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3129);


class STSServiceException extends _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_0__.ServiceException {
    constructor(options) {
        super(options);
        Object.setPrototypeOf(this, STSServiceException.prototype);
    }
}


/***/ }),

/***/ 4540:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   AssumeRoleResponseFilterSensitiveLog: () => (/* reexport safe */ _models_0__WEBPACK_IMPORTED_MODULE_0__.AssumeRoleResponseFilterSensitiveLog),
/* harmony export */   AssumeRoleWithWebIdentityRequestFilterSensitiveLog: () => (/* reexport safe */ _models_0__WEBPACK_IMPORTED_MODULE_0__.AssumeRoleWithWebIdentityRequestFilterSensitiveLog),
/* harmony export */   AssumeRoleWithWebIdentityResponseFilterSensitiveLog: () => (/* reexport safe */ _models_0__WEBPACK_IMPORTED_MODULE_0__.AssumeRoleWithWebIdentityResponseFilterSensitiveLog),
/* harmony export */   CredentialsFilterSensitiveLog: () => (/* reexport safe */ _models_0__WEBPACK_IMPORTED_MODULE_0__.CredentialsFilterSensitiveLog),
/* harmony export */   ExpiredTokenException: () => (/* reexport safe */ _models_0__WEBPACK_IMPORTED_MODULE_0__.ExpiredTokenException),
/* harmony export */   IDPCommunicationErrorException: () => (/* reexport safe */ _models_0__WEBPACK_IMPORTED_MODULE_0__.IDPCommunicationErrorException),
/* harmony export */   IDPRejectedClaimException: () => (/* reexport safe */ _models_0__WEBPACK_IMPORTED_MODULE_0__.IDPRejectedClaimException),
/* harmony export */   InvalidIdentityTokenException: () => (/* reexport safe */ _models_0__WEBPACK_IMPORTED_MODULE_0__.InvalidIdentityTokenException),
/* harmony export */   MalformedPolicyDocumentException: () => (/* reexport safe */ _models_0__WEBPACK_IMPORTED_MODULE_0__.MalformedPolicyDocumentException),
/* harmony export */   PackedPolicyTooLargeException: () => (/* reexport safe */ _models_0__WEBPACK_IMPORTED_MODULE_0__.PackedPolicyTooLargeException),
/* harmony export */   RegionDisabledException: () => (/* reexport safe */ _models_0__WEBPACK_IMPORTED_MODULE_0__.RegionDisabledException)
/* harmony export */ });
/* harmony import */ var _models_0__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(4535);



/***/ }),

/***/ 4535:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   AssumeRoleResponseFilterSensitiveLog: () => (/* binding */ AssumeRoleResponseFilterSensitiveLog),
/* harmony export */   AssumeRoleWithWebIdentityRequestFilterSensitiveLog: () => (/* binding */ AssumeRoleWithWebIdentityRequestFilterSensitiveLog),
/* harmony export */   AssumeRoleWithWebIdentityResponseFilterSensitiveLog: () => (/* binding */ AssumeRoleWithWebIdentityResponseFilterSensitiveLog),
/* harmony export */   CredentialsFilterSensitiveLog: () => (/* binding */ CredentialsFilterSensitiveLog),
/* harmony export */   ExpiredTokenException: () => (/* binding */ ExpiredTokenException),
/* harmony export */   IDPCommunicationErrorException: () => (/* binding */ IDPCommunicationErrorException),
/* harmony export */   IDPRejectedClaimException: () => (/* binding */ IDPRejectedClaimException),
/* harmony export */   InvalidIdentityTokenException: () => (/* binding */ InvalidIdentityTokenException),
/* harmony export */   MalformedPolicyDocumentException: () => (/* binding */ MalformedPolicyDocumentException),
/* harmony export */   PackedPolicyTooLargeException: () => (/* binding */ PackedPolicyTooLargeException),
/* harmony export */   RegionDisabledException: () => (/* binding */ RegionDisabledException)
/* harmony export */ });
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3130);
/* harmony import */ var _STSServiceException__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(4536);


const CredentialsFilterSensitiveLog = (obj) => ({
    ...obj,
    ...(obj.SecretAccessKey && { SecretAccessKey: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_0__.SENSITIVE_STRING }),
});
const AssumeRoleResponseFilterSensitiveLog = (obj) => ({
    ...obj,
    ...(obj.Credentials && { Credentials: CredentialsFilterSensitiveLog(obj.Credentials) }),
});
class ExpiredTokenException extends _STSServiceException__WEBPACK_IMPORTED_MODULE_1__.STSServiceException {
    name = "ExpiredTokenException";
    $fault = "client";
    constructor(opts) {
        super({
            name: "ExpiredTokenException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, ExpiredTokenException.prototype);
    }
}
class MalformedPolicyDocumentException extends _STSServiceException__WEBPACK_IMPORTED_MODULE_1__.STSServiceException {
    name = "MalformedPolicyDocumentException";
    $fault = "client";
    constructor(opts) {
        super({
            name: "MalformedPolicyDocumentException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, MalformedPolicyDocumentException.prototype);
    }
}
class PackedPolicyTooLargeException extends _STSServiceException__WEBPACK_IMPORTED_MODULE_1__.STSServiceException {
    name = "PackedPolicyTooLargeException";
    $fault = "client";
    constructor(opts) {
        super({
            name: "PackedPolicyTooLargeException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, PackedPolicyTooLargeException.prototype);
    }
}
class RegionDisabledException extends _STSServiceException__WEBPACK_IMPORTED_MODULE_1__.STSServiceException {
    name = "RegionDisabledException";
    $fault = "client";
    constructor(opts) {
        super({
            name: "RegionDisabledException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, RegionDisabledException.prototype);
    }
}
class IDPRejectedClaimException extends _STSServiceException__WEBPACK_IMPORTED_MODULE_1__.STSServiceException {
    name = "IDPRejectedClaimException";
    $fault = "client";
    constructor(opts) {
        super({
            name: "IDPRejectedClaimException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, IDPRejectedClaimException.prototype);
    }
}
class InvalidIdentityTokenException extends _STSServiceException__WEBPACK_IMPORTED_MODULE_1__.STSServiceException {
    name = "InvalidIdentityTokenException";
    $fault = "client";
    constructor(opts) {
        super({
            name: "InvalidIdentityTokenException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, InvalidIdentityTokenException.prototype);
    }
}
const AssumeRoleWithWebIdentityRequestFilterSensitiveLog = (obj) => ({
    ...obj,
    ...(obj.WebIdentityToken && { WebIdentityToken: _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_0__.SENSITIVE_STRING }),
});
const AssumeRoleWithWebIdentityResponseFilterSensitiveLog = (obj) => ({
    ...obj,
    ...(obj.Credentials && { Credentials: CredentialsFilterSensitiveLog(obj.Credentials) }),
});
class IDPCommunicationErrorException extends _STSServiceException__WEBPACK_IMPORTED_MODULE_1__.STSServiceException {
    name = "IDPCommunicationErrorException";
    $fault = "client";
    constructor(opts) {
        super({
            name: "IDPCommunicationErrorException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, IDPCommunicationErrorException.prototype);
    }
}


/***/ }),

/***/ 4537:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   de_AssumeRoleCommand: () => (/* binding */ de_AssumeRoleCommand),
/* harmony export */   de_AssumeRoleWithWebIdentityCommand: () => (/* binding */ de_AssumeRoleWithWebIdentityCommand),
/* harmony export */   se_AssumeRoleCommand: () => (/* binding */ se_AssumeRoleCommand),
/* harmony export */   se_AssumeRoleWithWebIdentityCommand: () => (/* binding */ se_AssumeRoleWithWebIdentityCommand)
/* harmony export */ });
/* harmony import */ var _aws_sdk_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3155);
/* harmony import */ var _smithy_protocol_http__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(3010);
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(3129);
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(3139);
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(3138);
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(3149);
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(3170);
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(3135);
/* harmony import */ var _models_models_0__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(4535);
/* harmony import */ var _models_STSServiceException__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(4536);





const se_AssumeRoleCommand = async (input, context) => {
    const headers = SHARED_HEADERS;
    let body;
    body = buildFormUrlencodedString({
        ...se_AssumeRoleRequest(input, context),
        [_A]: _AR,
        [_V]: _,
    });
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const se_AssumeRoleWithWebIdentityCommand = async (input, context) => {
    const headers = SHARED_HEADERS;
    let body;
    body = buildFormUrlencodedString({
        ...se_AssumeRoleWithWebIdentityRequest(input, context),
        [_A]: _ARWWI,
        [_V]: _,
    });
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
const de_AssumeRoleCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await (0,_aws_sdk_core__WEBPACK_IMPORTED_MODULE_0__.parseXmlBody)(output.body, context);
    let contents = {};
    contents = de_AssumeRoleResponse(data.AssumeRoleResult, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_AssumeRoleWithWebIdentityCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await (0,_aws_sdk_core__WEBPACK_IMPORTED_MODULE_0__.parseXmlBody)(output.body, context);
    let contents = {};
    contents = de_AssumeRoleWithWebIdentityResponse(data.AssumeRoleWithWebIdentityResult, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_CommandError = async (output, context) => {
    const parsedOutput = {
        ...output,
        body: await (0,_aws_sdk_core__WEBPACK_IMPORTED_MODULE_0__.parseXmlErrorBody)(output.body, context),
    };
    const errorCode = loadQueryErrorCode(output, parsedOutput.body);
    switch (errorCode) {
        case "ExpiredTokenException":
        case "com.amazonaws.sts#ExpiredTokenException":
            throw await de_ExpiredTokenExceptionRes(parsedOutput, context);
        case "MalformedPolicyDocument":
        case "com.amazonaws.sts#MalformedPolicyDocumentException":
            throw await de_MalformedPolicyDocumentExceptionRes(parsedOutput, context);
        case "PackedPolicyTooLarge":
        case "com.amazonaws.sts#PackedPolicyTooLargeException":
            throw await de_PackedPolicyTooLargeExceptionRes(parsedOutput, context);
        case "RegionDisabledException":
        case "com.amazonaws.sts#RegionDisabledException":
            throw await de_RegionDisabledExceptionRes(parsedOutput, context);
        case "IDPCommunicationError":
        case "com.amazonaws.sts#IDPCommunicationErrorException":
            throw await de_IDPCommunicationErrorExceptionRes(parsedOutput, context);
        case "IDPRejectedClaim":
        case "com.amazonaws.sts#IDPRejectedClaimException":
            throw await de_IDPRejectedClaimExceptionRes(parsedOutput, context);
        case "InvalidIdentityToken":
        case "com.amazonaws.sts#InvalidIdentityTokenException":
            throw await de_InvalidIdentityTokenExceptionRes(parsedOutput, context);
        default:
            const parsedBody = parsedOutput.body;
            return throwDefaultError({
                output,
                parsedBody: parsedBody.Error,
                errorCode,
            });
    }
};
const de_ExpiredTokenExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = de_ExpiredTokenException(body.Error, context);
    const exception = new _models_models_0__WEBPACK_IMPORTED_MODULE_1__.ExpiredTokenException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_2__.decorateServiceException)(exception, body);
};
const de_IDPCommunicationErrorExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = de_IDPCommunicationErrorException(body.Error, context);
    const exception = new _models_models_0__WEBPACK_IMPORTED_MODULE_1__.IDPCommunicationErrorException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_2__.decorateServiceException)(exception, body);
};
const de_IDPRejectedClaimExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = de_IDPRejectedClaimException(body.Error, context);
    const exception = new _models_models_0__WEBPACK_IMPORTED_MODULE_1__.IDPRejectedClaimException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_2__.decorateServiceException)(exception, body);
};
const de_InvalidIdentityTokenExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = de_InvalidIdentityTokenException(body.Error, context);
    const exception = new _models_models_0__WEBPACK_IMPORTED_MODULE_1__.InvalidIdentityTokenException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_2__.decorateServiceException)(exception, body);
};
const de_MalformedPolicyDocumentExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = de_MalformedPolicyDocumentException(body.Error, context);
    const exception = new _models_models_0__WEBPACK_IMPORTED_MODULE_1__.MalformedPolicyDocumentException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_2__.decorateServiceException)(exception, body);
};
const de_PackedPolicyTooLargeExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = de_PackedPolicyTooLargeException(body.Error, context);
    const exception = new _models_models_0__WEBPACK_IMPORTED_MODULE_1__.PackedPolicyTooLargeException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_2__.decorateServiceException)(exception, body);
};
const de_RegionDisabledExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = de_RegionDisabledException(body.Error, context);
    const exception = new _models_models_0__WEBPACK_IMPORTED_MODULE_1__.RegionDisabledException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_2__.decorateServiceException)(exception, body);
};
const se_AssumeRoleRequest = (input, context) => {
    const entries = {};
    if (input[_RA] != null) {
        entries[_RA] = input[_RA];
    }
    if (input[_RSN] != null) {
        entries[_RSN] = input[_RSN];
    }
    if (input[_PA] != null) {
        const memberEntries = se_policyDescriptorListType(input[_PA], context);
        if (input[_PA]?.length === 0) {
            entries.PolicyArns = [];
        }
        Object.entries(memberEntries).forEach(([key, value]) => {
            const loc = `PolicyArns.${key}`;
            entries[loc] = value;
        });
    }
    if (input[_P] != null) {
        entries[_P] = input[_P];
    }
    if (input[_DS] != null) {
        entries[_DS] = input[_DS];
    }
    if (input[_T] != null) {
        const memberEntries = se_tagListType(input[_T], context);
        if (input[_T]?.length === 0) {
            entries.Tags = [];
        }
        Object.entries(memberEntries).forEach(([key, value]) => {
            const loc = `Tags.${key}`;
            entries[loc] = value;
        });
    }
    if (input[_TTK] != null) {
        const memberEntries = se_tagKeyListType(input[_TTK], context);
        if (input[_TTK]?.length === 0) {
            entries.TransitiveTagKeys = [];
        }
        Object.entries(memberEntries).forEach(([key, value]) => {
            const loc = `TransitiveTagKeys.${key}`;
            entries[loc] = value;
        });
    }
    if (input[_EI] != null) {
        entries[_EI] = input[_EI];
    }
    if (input[_SN] != null) {
        entries[_SN] = input[_SN];
    }
    if (input[_TC] != null) {
        entries[_TC] = input[_TC];
    }
    if (input[_SI] != null) {
        entries[_SI] = input[_SI];
    }
    if (input[_PC] != null) {
        const memberEntries = se_ProvidedContextsListType(input[_PC], context);
        if (input[_PC]?.length === 0) {
            entries.ProvidedContexts = [];
        }
        Object.entries(memberEntries).forEach(([key, value]) => {
            const loc = `ProvidedContexts.${key}`;
            entries[loc] = value;
        });
    }
    return entries;
};
const se_AssumeRoleWithWebIdentityRequest = (input, context) => {
    const entries = {};
    if (input[_RA] != null) {
        entries[_RA] = input[_RA];
    }
    if (input[_RSN] != null) {
        entries[_RSN] = input[_RSN];
    }
    if (input[_WIT] != null) {
        entries[_WIT] = input[_WIT];
    }
    if (input[_PI] != null) {
        entries[_PI] = input[_PI];
    }
    if (input[_PA] != null) {
        const memberEntries = se_policyDescriptorListType(input[_PA], context);
        if (input[_PA]?.length === 0) {
            entries.PolicyArns = [];
        }
        Object.entries(memberEntries).forEach(([key, value]) => {
            const loc = `PolicyArns.${key}`;
            entries[loc] = value;
        });
    }
    if (input[_P] != null) {
        entries[_P] = input[_P];
    }
    if (input[_DS] != null) {
        entries[_DS] = input[_DS];
    }
    return entries;
};
const se_policyDescriptorListType = (input, context) => {
    const entries = {};
    let counter = 1;
    for (const entry of input) {
        if (entry === null) {
            continue;
        }
        const memberEntries = se_PolicyDescriptorType(entry, context);
        Object.entries(memberEntries).forEach(([key, value]) => {
            entries[`member.${counter}.${key}`] = value;
        });
        counter++;
    }
    return entries;
};
const se_PolicyDescriptorType = (input, context) => {
    const entries = {};
    if (input[_a] != null) {
        entries[_a] = input[_a];
    }
    return entries;
};
const se_ProvidedContext = (input, context) => {
    const entries = {};
    if (input[_PAr] != null) {
        entries[_PAr] = input[_PAr];
    }
    if (input[_CA] != null) {
        entries[_CA] = input[_CA];
    }
    return entries;
};
const se_ProvidedContextsListType = (input, context) => {
    const entries = {};
    let counter = 1;
    for (const entry of input) {
        if (entry === null) {
            continue;
        }
        const memberEntries = se_ProvidedContext(entry, context);
        Object.entries(memberEntries).forEach(([key, value]) => {
            entries[`member.${counter}.${key}`] = value;
        });
        counter++;
    }
    return entries;
};
const se_Tag = (input, context) => {
    const entries = {};
    if (input[_K] != null) {
        entries[_K] = input[_K];
    }
    if (input[_Va] != null) {
        entries[_Va] = input[_Va];
    }
    return entries;
};
const se_tagKeyListType = (input, context) => {
    const entries = {};
    let counter = 1;
    for (const entry of input) {
        if (entry === null) {
            continue;
        }
        entries[`member.${counter}`] = entry;
        counter++;
    }
    return entries;
};
const se_tagListType = (input, context) => {
    const entries = {};
    let counter = 1;
    for (const entry of input) {
        if (entry === null) {
            continue;
        }
        const memberEntries = se_Tag(entry, context);
        Object.entries(memberEntries).forEach(([key, value]) => {
            entries[`member.${counter}.${key}`] = value;
        });
        counter++;
    }
    return entries;
};
const de_AssumedRoleUser = (output, context) => {
    const contents = {};
    if (output[_ARI] != null) {
        contents[_ARI] = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString)(output[_ARI]);
    }
    if (output[_Ar] != null) {
        contents[_Ar] = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString)(output[_Ar]);
    }
    return contents;
};
const de_AssumeRoleResponse = (output, context) => {
    const contents = {};
    if (output[_C] != null) {
        contents[_C] = de_Credentials(output[_C], context);
    }
    if (output[_ARU] != null) {
        contents[_ARU] = de_AssumedRoleUser(output[_ARU], context);
    }
    if (output[_PPS] != null) {
        contents[_PPS] = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.strictParseInt32)(output[_PPS]);
    }
    if (output[_SI] != null) {
        contents[_SI] = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString)(output[_SI]);
    }
    return contents;
};
const de_AssumeRoleWithWebIdentityResponse = (output, context) => {
    const contents = {};
    if (output[_C] != null) {
        contents[_C] = de_Credentials(output[_C], context);
    }
    if (output[_SFWIT] != null) {
        contents[_SFWIT] = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString)(output[_SFWIT]);
    }
    if (output[_ARU] != null) {
        contents[_ARU] = de_AssumedRoleUser(output[_ARU], context);
    }
    if (output[_PPS] != null) {
        contents[_PPS] = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.strictParseInt32)(output[_PPS]);
    }
    if (output[_Pr] != null) {
        contents[_Pr] = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString)(output[_Pr]);
    }
    if (output[_Au] != null) {
        contents[_Au] = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString)(output[_Au]);
    }
    if (output[_SI] != null) {
        contents[_SI] = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString)(output[_SI]);
    }
    return contents;
};
const de_Credentials = (output, context) => {
    const contents = {};
    if (output[_AKI] != null) {
        contents[_AKI] = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString)(output[_AKI]);
    }
    if (output[_SAK] != null) {
        contents[_SAK] = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString)(output[_SAK]);
    }
    if (output[_ST] != null) {
        contents[_ST] = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString)(output[_ST]);
    }
    if (output[_E] != null) {
        contents[_E] = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectNonNull)((0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_4__.parseRfc3339DateTimeWithOffset)(output[_E]));
    }
    return contents;
};
const de_ExpiredTokenException = (output, context) => {
    const contents = {};
    if (output[_m] != null) {
        contents[_m] = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString)(output[_m]);
    }
    return contents;
};
const de_IDPCommunicationErrorException = (output, context) => {
    const contents = {};
    if (output[_m] != null) {
        contents[_m] = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString)(output[_m]);
    }
    return contents;
};
const de_IDPRejectedClaimException = (output, context) => {
    const contents = {};
    if (output[_m] != null) {
        contents[_m] = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString)(output[_m]);
    }
    return contents;
};
const de_InvalidIdentityTokenException = (output, context) => {
    const contents = {};
    if (output[_m] != null) {
        contents[_m] = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString)(output[_m]);
    }
    return contents;
};
const de_MalformedPolicyDocumentException = (output, context) => {
    const contents = {};
    if (output[_m] != null) {
        contents[_m] = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString)(output[_m]);
    }
    return contents;
};
const de_PackedPolicyTooLargeException = (output, context) => {
    const contents = {};
    if (output[_m] != null) {
        contents[_m] = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString)(output[_m]);
    }
    return contents;
};
const de_RegionDisabledException = (output, context) => {
    const contents = {};
    if (output[_m] != null) {
        contents[_m] = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_3__.expectString)(output[_m]);
    }
    return contents;
};
const deserializeMetadata = (output) => ({
    httpStatusCode: output.statusCode,
    requestId: output.headers["x-amzn-requestid"] ?? output.headers["x-amzn-request-id"] ?? output.headers["x-amz-request-id"],
    extendedRequestId: output.headers["x-amz-id-2"],
    cfId: output.headers["x-amz-cf-id"],
});
const collectBodyString = (streamBody, context) => (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_5__.collectBody)(streamBody, context).then((body) => context.utf8Encoder(body));
const throwDefaultError = (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_6__.withBaseException)(_models_STSServiceException__WEBPACK_IMPORTED_MODULE_7__.STSServiceException);
const buildHttpRpcRequest = async (context, headers, path, resolvedHostname, body) => {
    const { hostname, protocol = "https", port, path: basePath } = await context.endpoint();
    const contents = {
        protocol,
        hostname,
        port,
        method: "POST",
        path: basePath.endsWith("/") ? basePath.slice(0, -1) + path : basePath + path,
        headers,
    };
    if (resolvedHostname !== undefined) {
        contents.hostname = resolvedHostname;
    }
    if (body !== undefined) {
        contents.body = body;
    }
    return new _smithy_protocol_http__WEBPACK_IMPORTED_MODULE_8__.HttpRequest(contents);
};
const SHARED_HEADERS = {
    "content-type": "application/x-www-form-urlencoded",
};
const _ = "2011-06-15";
const _A = "Action";
const _AKI = "AccessKeyId";
const _AR = "AssumeRole";
const _ARI = "AssumedRoleId";
const _ARU = "AssumedRoleUser";
const _ARWWI = "AssumeRoleWithWebIdentity";
const _Ar = "Arn";
const _Au = "Audience";
const _C = "Credentials";
const _CA = "ContextAssertion";
const _DS = "DurationSeconds";
const _E = "Expiration";
const _EI = "ExternalId";
const _K = "Key";
const _P = "Policy";
const _PA = "PolicyArns";
const _PAr = "ProviderArn";
const _PC = "ProvidedContexts";
const _PI = "ProviderId";
const _PPS = "PackedPolicySize";
const _Pr = "Provider";
const _RA = "RoleArn";
const _RSN = "RoleSessionName";
const _SAK = "SecretAccessKey";
const _SFWIT = "SubjectFromWebIdentityToken";
const _SI = "SourceIdentity";
const _SN = "SerialNumber";
const _ST = "SessionToken";
const _T = "Tags";
const _TC = "TokenCode";
const _TTK = "TransitiveTagKeys";
const _V = "Version";
const _Va = "Value";
const _WIT = "WebIdentityToken";
const _a = "arn";
const _m = "message";
const buildFormUrlencodedString = (formEntries) => Object.entries(formEntries)
    .map(([key, value]) => (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_9__.extendedEncodeURIComponent)(key) + "=" + (0,_smithy_smithy_client__WEBPACK_IMPORTED_MODULE_9__.extendedEncodeURIComponent)(value))
    .join("&");
const loadQueryErrorCode = (output, data) => {
    if (data.Error?.Code !== undefined) {
        return data.Error.Code;
    }
    if (output.statusCode == 404) {
        return "NotFound";
    }
};


/***/ }),

/***/ 4527:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getRuntimeConfig: () => (/* binding */ getRuntimeConfig)
/* harmony export */ });
/* harmony import */ var _package_json__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(4510);
/* harmony import */ var _aws_sdk_core__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(3219);
/* harmony import */ var _aws_sdk_core__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(3220);
/* harmony import */ var _aws_sdk_core__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(3201);
/* harmony import */ var _aws_sdk_util_user_agent_node__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(3227);
/* harmony import */ var _aws_sdk_util_user_agent_node__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(3285);
/* harmony import */ var _smithy_config_resolver__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(3217);
/* harmony import */ var _smithy_config_resolver__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(3283);
/* harmony import */ var _smithy_config_resolver__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(3284);
/* harmony import */ var _smithy_core__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(4502);
/* harmony import */ var _smithy_hash_node__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(3198);
/* harmony import */ var _smithy_middleware_retry__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(3257);
/* harmony import */ var _smithy_node_config_provider__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(3081);
/* harmony import */ var _smithy_node_http_handler__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(3270);
/* harmony import */ var _smithy_node_http_handler__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(3211);
/* harmony import */ var _smithy_util_body_length_node__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(3223);
/* harmony import */ var _smithy_util_retry__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(3258);
/* harmony import */ var _runtimeConfig_shared__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(4528);
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
        httpAuthSchemes: config?.httpAuthSchemes ?? [
            {
                schemeId: "aws.auth#sigv4",
                identityProvider: (ipc) => ipc.getIdentityProvider("aws.auth#sigv4") ||
                    (async (idProps) => await config.credentialDefaultProvider(idProps?.__config || {})()),
                signer: new _aws_sdk_core__WEBPACK_IMPORTED_MODULE_10__.AwsSdkSigV4Signer(),
            },
            {
                schemeId: "smithy.api#noAuth",
                identityProvider: (ipc) => ipc.getIdentityProvider("smithy.api#noAuth") || (async () => ({})),
                signer: new _smithy_core__WEBPACK_IMPORTED_MODULE_11__.NoAuthSigner(),
            },
        ],
        maxAttempts: config?.maxAttempts ?? (0,_smithy_node_config_provider__WEBPACK_IMPORTED_MODULE_5__.loadConfig)(_smithy_middleware_retry__WEBPACK_IMPORTED_MODULE_12__.NODE_MAX_ATTEMPT_CONFIG_OPTIONS, config),
        region: config?.region ??
            (0,_smithy_node_config_provider__WEBPACK_IMPORTED_MODULE_5__.loadConfig)(_smithy_config_resolver__WEBPACK_IMPORTED_MODULE_13__.NODE_REGION_CONFIG_OPTIONS, { ..._smithy_config_resolver__WEBPACK_IMPORTED_MODULE_13__.NODE_REGION_CONFIG_FILE_OPTIONS, ...loaderConfig }),
        requestHandler: _smithy_node_http_handler__WEBPACK_IMPORTED_MODULE_14__.NodeHttpHandler.create(config?.requestHandler ?? defaultConfigProvider),
        retryMode: config?.retryMode ??
            (0,_smithy_node_config_provider__WEBPACK_IMPORTED_MODULE_5__.loadConfig)({
                ..._smithy_middleware_retry__WEBPACK_IMPORTED_MODULE_12__.NODE_RETRY_MODE_CONFIG_OPTIONS,
                default: async () => (await defaultConfigProvider()).retryMode || _smithy_util_retry__WEBPACK_IMPORTED_MODULE_15__.DEFAULT_RETRY_MODE,
            }, config),
        sha256: config?.sha256 ?? _smithy_hash_node__WEBPACK_IMPORTED_MODULE_16__.Hash.bind(null, "sha256"),
        streamCollector: config?.streamCollector ?? _smithy_node_http_handler__WEBPACK_IMPORTED_MODULE_17__.streamCollector,
        useDualstackEndpoint: config?.useDualstackEndpoint ?? (0,_smithy_node_config_provider__WEBPACK_IMPORTED_MODULE_5__.loadConfig)(_smithy_config_resolver__WEBPACK_IMPORTED_MODULE_18__.NODE_USE_DUALSTACK_ENDPOINT_CONFIG_OPTIONS, loaderConfig),
        useFipsEndpoint: config?.useFipsEndpoint ?? (0,_smithy_node_config_provider__WEBPACK_IMPORTED_MODULE_5__.loadConfig)(_smithy_config_resolver__WEBPACK_IMPORTED_MODULE_19__.NODE_USE_FIPS_ENDPOINT_CONFIG_OPTIONS, loaderConfig),
        userAgentAppId: config?.userAgentAppId ?? (0,_smithy_node_config_provider__WEBPACK_IMPORTED_MODULE_5__.loadConfig)(_aws_sdk_util_user_agent_node__WEBPACK_IMPORTED_MODULE_20__.NODE_APP_ID_CONFIG_OPTIONS, loaderConfig),
    };
};


/***/ }),

/***/ 4528:
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
/* harmony import */ var _auth_httpAuthSchemeProvider__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(4525);
/* harmony import */ var _endpoint_endpointResolver__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(4529);








const getRuntimeConfig = (config) => {
    return {
        apiVersion: "2011-06-15",
        base64Decoder: config?.base64Decoder ?? _smithy_util_base64__WEBPACK_IMPORTED_MODULE_0__.fromBase64,
        base64Encoder: config?.base64Encoder ?? _smithy_util_base64__WEBPACK_IMPORTED_MODULE_1__.toBase64,
        disableHostPrefix: config?.disableHostPrefix ?? false,
        endpointProvider: config?.endpointProvider ?? _endpoint_endpointResolver__WEBPACK_IMPORTED_MODULE_2__.defaultEndpointResolver,
        extensions: config?.extensions ?? [],
        httpAuthSchemeProvider: config?.httpAuthSchemeProvider ?? _auth_httpAuthSchemeProvider__WEBPACK_IMPORTED_MODULE_3__.defaultSTSHttpAuthSchemeProvider,
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
        serviceId: config?.serviceId ?? "STS",
        urlParser: config?.urlParser ?? _smithy_url_parser__WEBPACK_IMPORTED_MODULE_7__.parseUrl,
        utf8Decoder: config?.utf8Decoder ?? _smithy_util_utf8__WEBPACK_IMPORTED_MODULE_8__.fromUtf8,
        utf8Encoder: config?.utf8Encoder ?? _smithy_util_utf8__WEBPACK_IMPORTED_MODULE_9__.toUtf8,
    };
};


/***/ }),

/***/ 4531:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   resolveRuntimeExtensions: () => (/* binding */ resolveRuntimeExtensions)
/* harmony export */ });
/* harmony import */ var _aws_sdk_region_config_resolver__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3289);
/* harmony import */ var _smithy_protocol_http__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(3294);
/* harmony import */ var _smithy_smithy_client__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3290);
/* harmony import */ var _auth_httpAuthExtensionConfiguration__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(4532);




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

/***/ 4510:
/***/ ((module) => {

module.exports = /*#__PURE__*/JSON.parse('{"name":"@aws-sdk/nested-clients","version":"3.901.0","description":"Nested clients for AWS SDK packages.","main":"./dist-cjs/index.js","module":"./dist-es/index.js","types":"./dist-types/index.d.ts","scripts":{"build":"yarn lint && concurrently \'yarn:build:cjs\' \'yarn:build:es\' \'yarn:build:types\'","build:cjs":"node ../../scripts/compilation/inline nested-clients","build:es":"tsc -p tsconfig.es.json","build:include:deps":"lerna run --scope $npm_package_name --include-dependencies build","build:types":"tsc -p tsconfig.types.json","build:types:downlevel":"downlevel-dts dist-types dist-types/ts3.4","clean":"rimraf ./dist-* && rimraf *.tsbuildinfo","lint":"node ../../scripts/validation/submodules-linter.js --pkg nested-clients","test":"yarn g:vitest run","test:watch":"yarn g:vitest watch"},"engines":{"node":">=18.0.0"},"sideEffects":false,"author":{"name":"AWS SDK for JavaScript Team","url":"https://aws.amazon.com/javascript/"},"license":"Apache-2.0","dependencies":{"@aws-crypto/sha256-browser":"5.2.0","@aws-crypto/sha256-js":"5.2.0","@aws-sdk/core":"3.901.0","@aws-sdk/middleware-host-header":"3.901.0","@aws-sdk/middleware-logger":"3.901.0","@aws-sdk/middleware-recursion-detection":"3.901.0","@aws-sdk/middleware-user-agent":"3.901.0","@aws-sdk/region-config-resolver":"3.901.0","@aws-sdk/types":"3.901.0","@aws-sdk/util-endpoints":"3.901.0","@aws-sdk/util-user-agent-browser":"3.901.0","@aws-sdk/util-user-agent-node":"3.901.0","@smithy/config-resolver":"^4.3.0","@smithy/core":"^3.14.0","@smithy/fetch-http-handler":"^5.3.0","@smithy/hash-node":"^4.2.0","@smithy/invalid-dependency":"^4.2.0","@smithy/middleware-content-length":"^4.2.0","@smithy/middleware-endpoint":"^4.3.0","@smithy/middleware-retry":"^4.4.0","@smithy/middleware-serde":"^4.2.0","@smithy/middleware-stack":"^4.2.0","@smithy/node-config-provider":"^4.3.0","@smithy/node-http-handler":"^4.3.0","@smithy/protocol-http":"^5.3.0","@smithy/smithy-client":"^4.7.0","@smithy/types":"^4.6.0","@smithy/url-parser":"^4.2.0","@smithy/util-base64":"^4.2.0","@smithy/util-body-length-browser":"^4.2.0","@smithy/util-body-length-node":"^4.2.0","@smithy/util-defaults-mode-browser":"^4.2.0","@smithy/util-defaults-mode-node":"^4.2.0","@smithy/util-endpoints":"^3.2.0","@smithy/util-middleware":"^4.2.0","@smithy/util-retry":"^4.2.0","@smithy/util-utf8":"^4.2.0","tslib":"^2.6.2"},"devDependencies":{"concurrently":"7.0.0","downlevel-dts":"0.10.1","rimraf":"3.0.2","typescript":"~5.8.3"},"typesVersions":{"<4.0":{"dist-types/*":["dist-types/ts3.4/*"]}},"files":["./sso-oidc.d.ts","./sso-oidc.js","./sts.d.ts","./sts.js","dist-*/**"],"browser":{"./dist-es/submodules/sso-oidc/runtimeConfig":"./dist-es/submodules/sso-oidc/runtimeConfig.browser","./dist-es/submodules/sts/runtimeConfig":"./dist-es/submodules/sts/runtimeConfig.browser"},"react-native":{},"homepage":"https://github.com/aws/aws-sdk-js-v3/tree/main/packages/nested-clients","repository":{"type":"git","url":"https://github.com/aws/aws-sdk-js-v3.git","directory":"packages/nested-clients"},"exports":{"./sso-oidc":{"types":"./dist-types/submodules/sso-oidc/index.d.ts","module":"./dist-es/submodules/sso-oidc/index.js","node":"./dist-cjs/submodules/sso-oidc/index.js","import":"./dist-es/submodules/sso-oidc/index.js","require":"./dist-cjs/submodules/sso-oidc/index.js"},"./sts":{"types":"./dist-types/submodules/sts/index.d.ts","module":"./dist-es/submodules/sts/index.js","node":"./dist-cjs/submodules/sts/index.js","import":"./dist-es/submodules/sts/index.js","require":"./dist-cjs/submodules/sts/index.js"}}}');

/***/ })

};
;