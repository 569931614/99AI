"use strict";
exports.id = 1;
exports.ids = [1];
exports.modules = {

/***/ 4321:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Endpoint: () => (/* binding */ Endpoint)
/* harmony export */ });
var Endpoint;
(function (Endpoint) {
    Endpoint["IPv4"] = "http://169.254.169.254";
    Endpoint["IPv6"] = "http://[fd00:ec2::254]";
})(Endpoint || (Endpoint = {}));


/***/ }),

/***/ 4322:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CONFIG_ENDPOINT_NAME: () => (/* binding */ CONFIG_ENDPOINT_NAME),
/* harmony export */   ENDPOINT_CONFIG_OPTIONS: () => (/* binding */ ENDPOINT_CONFIG_OPTIONS),
/* harmony export */   ENV_ENDPOINT_NAME: () => (/* binding */ ENV_ENDPOINT_NAME)
/* harmony export */ });
const ENV_ENDPOINT_NAME = "AWS_EC2_METADATA_SERVICE_ENDPOINT";
const CONFIG_ENDPOINT_NAME = "ec2_metadata_service_endpoint";
const ENDPOINT_CONFIG_OPTIONS = {
    environmentVariableSelector: (env) => env[ENV_ENDPOINT_NAME],
    configFileSelector: (profile) => profile[CONFIG_ENDPOINT_NAME],
    default: undefined,
};


/***/ }),

/***/ 4323:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   EndpointMode: () => (/* binding */ EndpointMode)
/* harmony export */ });
var EndpointMode;
(function (EndpointMode) {
    EndpointMode["IPv4"] = "IPv4";
    EndpointMode["IPv6"] = "IPv6";
})(EndpointMode || (EndpointMode = {}));


/***/ }),

/***/ 4324:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CONFIG_ENDPOINT_MODE_NAME: () => (/* binding */ CONFIG_ENDPOINT_MODE_NAME),
/* harmony export */   ENDPOINT_MODE_CONFIG_OPTIONS: () => (/* binding */ ENDPOINT_MODE_CONFIG_OPTIONS),
/* harmony export */   ENV_ENDPOINT_MODE_NAME: () => (/* binding */ ENV_ENDPOINT_MODE_NAME)
/* harmony export */ });
/* harmony import */ var _EndpointMode__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(4323);

const ENV_ENDPOINT_MODE_NAME = "AWS_EC2_METADATA_SERVICE_ENDPOINT_MODE";
const CONFIG_ENDPOINT_MODE_NAME = "ec2_metadata_service_endpoint_mode";
const ENDPOINT_MODE_CONFIG_OPTIONS = {
    environmentVariableSelector: (env) => env[ENV_ENDPOINT_MODE_NAME],
    configFileSelector: (profile) => profile[CONFIG_ENDPOINT_MODE_NAME],
    default: _EndpointMode__WEBPACK_IMPORTED_MODULE_0__.EndpointMode.IPv4,
};


/***/ }),

/***/ 4319:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   InstanceMetadataV1FallbackError: () => (/* binding */ InstanceMetadataV1FallbackError)
/* harmony export */ });
/* harmony import */ var _smithy_property_provider__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3032);

class InstanceMetadataV1FallbackError extends _smithy_property_provider__WEBPACK_IMPORTED_MODULE_0__.CredentialsProviderError {
    tryNextLink;
    name = "InstanceMetadataV1FallbackError";
    constructor(message, tryNextLink = true) {
        super(message, tryNextLink);
        this.tryNextLink = tryNextLink;
        Object.setPrototypeOf(this, InstanceMetadataV1FallbackError.prototype);
    }
}


/***/ }),

/***/ 4313:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ENV_CMDS_AUTH_TOKEN: () => (/* binding */ ENV_CMDS_AUTH_TOKEN),
/* harmony export */   ENV_CMDS_FULL_URI: () => (/* binding */ ENV_CMDS_FULL_URI),
/* harmony export */   ENV_CMDS_RELATIVE_URI: () => (/* binding */ ENV_CMDS_RELATIVE_URI),
/* harmony export */   fromContainerMetadata: () => (/* binding */ fromContainerMetadata)
/* harmony export */ });
/* harmony import */ var _smithy_property_provider__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(3032);
/* harmony import */ var url__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(700);
/* harmony import */ var url__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(url__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _remoteProvider_httpRequest__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(4314);
/* harmony import */ var _remoteProvider_ImdsCredentials__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(4315);
/* harmony import */ var _remoteProvider_RemoteProviderInit__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(4316);
/* harmony import */ var _remoteProvider_retry__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(4317);






const ENV_CMDS_FULL_URI = "AWS_CONTAINER_CREDENTIALS_FULL_URI";
const ENV_CMDS_RELATIVE_URI = "AWS_CONTAINER_CREDENTIALS_RELATIVE_URI";
const ENV_CMDS_AUTH_TOKEN = "AWS_CONTAINER_AUTHORIZATION_TOKEN";
const fromContainerMetadata = (init = {}) => {
    const { timeout, maxRetries } = (0,_remoteProvider_RemoteProviderInit__WEBPACK_IMPORTED_MODULE_1__.providerConfigFromInit)(init);
    return () => (0,_remoteProvider_retry__WEBPACK_IMPORTED_MODULE_2__.retry)(async () => {
        const requestOptions = await getCmdsUri({ logger: init.logger });
        const credsResponse = JSON.parse(await requestFromEcsImds(timeout, requestOptions));
        if (!(0,_remoteProvider_ImdsCredentials__WEBPACK_IMPORTED_MODULE_3__.isImdsCredentials)(credsResponse)) {
            throw new _smithy_property_provider__WEBPACK_IMPORTED_MODULE_4__.CredentialsProviderError("Invalid response received from instance metadata service.", {
                logger: init.logger,
            });
        }
        return (0,_remoteProvider_ImdsCredentials__WEBPACK_IMPORTED_MODULE_3__.fromImdsCredentials)(credsResponse);
    }, maxRetries);
};
const requestFromEcsImds = async (timeout, options) => {
    if (process.env[ENV_CMDS_AUTH_TOKEN]) {
        options.headers = {
            ...options.headers,
            Authorization: process.env[ENV_CMDS_AUTH_TOKEN],
        };
    }
    const buffer = await (0,_remoteProvider_httpRequest__WEBPACK_IMPORTED_MODULE_5__.httpRequest)({
        ...options,
        timeout,
    });
    return buffer.toString();
};
const CMDS_IP = "169.254.170.2";
const GREENGRASS_HOSTS = {
    localhost: true,
    "127.0.0.1": true,
};
const GREENGRASS_PROTOCOLS = {
    "http:": true,
    "https:": true,
};
const getCmdsUri = async ({ logger }) => {
    if (process.env[ENV_CMDS_RELATIVE_URI]) {
        return {
            hostname: CMDS_IP,
            path: process.env[ENV_CMDS_RELATIVE_URI],
        };
    }
    if (process.env[ENV_CMDS_FULL_URI]) {
        const parsed = (0,url__WEBPACK_IMPORTED_MODULE_0__.parse)(process.env[ENV_CMDS_FULL_URI]);
        if (!parsed.hostname || !(parsed.hostname in GREENGRASS_HOSTS)) {
            throw new _smithy_property_provider__WEBPACK_IMPORTED_MODULE_4__.CredentialsProviderError(`${parsed.hostname} is not a valid container metadata service hostname`, {
                tryNextLink: false,
                logger,
            });
        }
        if (!parsed.protocol || !(parsed.protocol in GREENGRASS_PROTOCOLS)) {
            throw new _smithy_property_provider__WEBPACK_IMPORTED_MODULE_4__.CredentialsProviderError(`${parsed.protocol} is not a valid container metadata service protocol`, {
                tryNextLink: false,
                logger,
            });
        }
        return {
            ...parsed,
            port: parsed.port ? parseInt(parsed.port, 10) : undefined,
        };
    }
    throw new _smithy_property_provider__WEBPACK_IMPORTED_MODULE_4__.CredentialsProviderError("The container metadata credential provider cannot be used unless" +
        ` the ${ENV_CMDS_RELATIVE_URI} or ${ENV_CMDS_FULL_URI} environment` +
        " variable is set", {
        tryNextLink: false,
        logger,
    });
};


/***/ }),

/***/ 4318:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   fromInstanceMetadata: () => (/* binding */ fromInstanceMetadata)
/* harmony export */ });
/* harmony import */ var _smithy_node_config_provider__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(3029);
/* harmony import */ var _smithy_property_provider__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(3032);
/* harmony import */ var _error_InstanceMetadataV1FallbackError__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(4319);
/* harmony import */ var _remoteProvider_httpRequest__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(4314);
/* harmony import */ var _remoteProvider_ImdsCredentials__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(4315);
/* harmony import */ var _remoteProvider_RemoteProviderInit__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(4316);
/* harmony import */ var _remoteProvider_retry__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(4317);
/* harmony import */ var _utils_getInstanceMetadataEndpoint__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(4320);
/* harmony import */ var _utils_staticStabilityProvider__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(4325);









const IMDS_PATH = "/latest/meta-data/iam/security-credentials/";
const IMDS_TOKEN_PATH = "/latest/api/token";
const AWS_EC2_METADATA_V1_DISABLED = "AWS_EC2_METADATA_V1_DISABLED";
const PROFILE_AWS_EC2_METADATA_V1_DISABLED = "ec2_metadata_v1_disabled";
const X_AWS_EC2_METADATA_TOKEN = "x-aws-ec2-metadata-token";
const fromInstanceMetadata = (init = {}) => (0,_utils_staticStabilityProvider__WEBPACK_IMPORTED_MODULE_0__.staticStabilityProvider)(getInstanceMetadataProvider(init), { logger: init.logger });
const getInstanceMetadataProvider = (init = {}) => {
    let disableFetchToken = false;
    const { logger, profile } = init;
    const { timeout, maxRetries } = (0,_remoteProvider_RemoteProviderInit__WEBPACK_IMPORTED_MODULE_1__.providerConfigFromInit)(init);
    const getCredentials = async (maxRetries, options) => {
        const isImdsV1Fallback = disableFetchToken || options.headers?.[X_AWS_EC2_METADATA_TOKEN] == null;
        if (isImdsV1Fallback) {
            let fallbackBlockedFromProfile = false;
            let fallbackBlockedFromProcessEnv = false;
            const configValue = await (0,_smithy_node_config_provider__WEBPACK_IMPORTED_MODULE_2__.loadConfig)({
                environmentVariableSelector: (env) => {
                    const envValue = env[AWS_EC2_METADATA_V1_DISABLED];
                    fallbackBlockedFromProcessEnv = !!envValue && envValue !== "false";
                    if (envValue === undefined) {
                        throw new _smithy_property_provider__WEBPACK_IMPORTED_MODULE_3__.CredentialsProviderError(`${AWS_EC2_METADATA_V1_DISABLED} not set in env, checking config file next.`, { logger: init.logger });
                    }
                    return fallbackBlockedFromProcessEnv;
                },
                configFileSelector: (profile) => {
                    const profileValue = profile[PROFILE_AWS_EC2_METADATA_V1_DISABLED];
                    fallbackBlockedFromProfile = !!profileValue && profileValue !== "false";
                    return fallbackBlockedFromProfile;
                },
                default: false,
            }, {
                profile,
            })();
            if (init.ec2MetadataV1Disabled || configValue) {
                const causes = [];
                if (init.ec2MetadataV1Disabled)
                    causes.push("credential provider initialization (runtime option ec2MetadataV1Disabled)");
                if (fallbackBlockedFromProfile)
                    causes.push(`config file profile (${PROFILE_AWS_EC2_METADATA_V1_DISABLED})`);
                if (fallbackBlockedFromProcessEnv)
                    causes.push(`process environment variable (${AWS_EC2_METADATA_V1_DISABLED})`);
                throw new _error_InstanceMetadataV1FallbackError__WEBPACK_IMPORTED_MODULE_4__.InstanceMetadataV1FallbackError(`AWS EC2 Metadata v1 fallback has been blocked by AWS SDK configuration in the following: [${causes.join(", ")}].`);
            }
        }
        const imdsProfile = (await (0,_remoteProvider_retry__WEBPACK_IMPORTED_MODULE_5__.retry)(async () => {
            let profile;
            try {
                profile = await getProfile(options);
            }
            catch (err) {
                if (err.statusCode === 401) {
                    disableFetchToken = false;
                }
                throw err;
            }
            return profile;
        }, maxRetries)).trim();
        return (0,_remoteProvider_retry__WEBPACK_IMPORTED_MODULE_5__.retry)(async () => {
            let creds;
            try {
                creds = await getCredentialsFromProfile(imdsProfile, options, init);
            }
            catch (err) {
                if (err.statusCode === 401) {
                    disableFetchToken = false;
                }
                throw err;
            }
            return creds;
        }, maxRetries);
    };
    return async () => {
        const endpoint = await (0,_utils_getInstanceMetadataEndpoint__WEBPACK_IMPORTED_MODULE_6__.getInstanceMetadataEndpoint)();
        if (disableFetchToken) {
            logger?.debug("AWS SDK Instance Metadata", "using v1 fallback (no token fetch)");
            return getCredentials(maxRetries, { ...endpoint, timeout });
        }
        else {
            let token;
            try {
                token = (await getMetadataToken({ ...endpoint, timeout })).toString();
            }
            catch (error) {
                if (error?.statusCode === 400) {
                    throw Object.assign(error, {
                        message: "EC2 Metadata token request returned error",
                    });
                }
                else if (error.message === "TimeoutError" || [403, 404, 405].includes(error.statusCode)) {
                    disableFetchToken = true;
                }
                logger?.debug("AWS SDK Instance Metadata", "using v1 fallback (initial)");
                return getCredentials(maxRetries, { ...endpoint, timeout });
            }
            return getCredentials(maxRetries, {
                ...endpoint,
                headers: {
                    [X_AWS_EC2_METADATA_TOKEN]: token,
                },
                timeout,
            });
        }
    };
};
const getMetadataToken = async (options) => (0,_remoteProvider_httpRequest__WEBPACK_IMPORTED_MODULE_7__.httpRequest)({
    ...options,
    path: IMDS_TOKEN_PATH,
    method: "PUT",
    headers: {
        "x-aws-ec2-metadata-token-ttl-seconds": "21600",
    },
});
const getProfile = async (options) => (await (0,_remoteProvider_httpRequest__WEBPACK_IMPORTED_MODULE_7__.httpRequest)({ ...options, path: IMDS_PATH })).toString();
const getCredentialsFromProfile = async (profile, options, init) => {
    const credentialsResponse = JSON.parse((await (0,_remoteProvider_httpRequest__WEBPACK_IMPORTED_MODULE_7__.httpRequest)({
        ...options,
        path: IMDS_PATH + profile,
    })).toString());
    if (!(0,_remoteProvider_ImdsCredentials__WEBPACK_IMPORTED_MODULE_8__.isImdsCredentials)(credentialsResponse)) {
        throw new _smithy_property_provider__WEBPACK_IMPORTED_MODULE_3__.CredentialsProviderError("Invalid response received from instance metadata service.", {
            logger: init.logger,
        });
    }
    return (0,_remoteProvider_ImdsCredentials__WEBPACK_IMPORTED_MODULE_8__.fromImdsCredentials)(credentialsResponse);
};


/***/ }),

/***/ 4312:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   DEFAULT_MAX_RETRIES: () => (/* reexport safe */ _remoteProvider_RemoteProviderInit__WEBPACK_IMPORTED_MODULE_2__.DEFAULT_MAX_RETRIES),
/* harmony export */   DEFAULT_TIMEOUT: () => (/* reexport safe */ _remoteProvider_RemoteProviderInit__WEBPACK_IMPORTED_MODULE_2__.DEFAULT_TIMEOUT),
/* harmony export */   ENV_CMDS_AUTH_TOKEN: () => (/* reexport safe */ _fromContainerMetadata__WEBPACK_IMPORTED_MODULE_0__.ENV_CMDS_AUTH_TOKEN),
/* harmony export */   ENV_CMDS_FULL_URI: () => (/* reexport safe */ _fromContainerMetadata__WEBPACK_IMPORTED_MODULE_0__.ENV_CMDS_FULL_URI),
/* harmony export */   ENV_CMDS_RELATIVE_URI: () => (/* reexport safe */ _fromContainerMetadata__WEBPACK_IMPORTED_MODULE_0__.ENV_CMDS_RELATIVE_URI),
/* harmony export */   Endpoint: () => (/* reexport safe */ _config_Endpoint__WEBPACK_IMPORTED_MODULE_5__.Endpoint),
/* harmony export */   fromContainerMetadata: () => (/* reexport safe */ _fromContainerMetadata__WEBPACK_IMPORTED_MODULE_0__.fromContainerMetadata),
/* harmony export */   fromInstanceMetadata: () => (/* reexport safe */ _fromInstanceMetadata__WEBPACK_IMPORTED_MODULE_1__.fromInstanceMetadata),
/* harmony export */   getInstanceMetadataEndpoint: () => (/* reexport safe */ _utils_getInstanceMetadataEndpoint__WEBPACK_IMPORTED_MODULE_4__.getInstanceMetadataEndpoint),
/* harmony export */   httpRequest: () => (/* reexport safe */ _remoteProvider_httpRequest__WEBPACK_IMPORTED_MODULE_3__.httpRequest),
/* harmony export */   providerConfigFromInit: () => (/* reexport safe */ _remoteProvider_RemoteProviderInit__WEBPACK_IMPORTED_MODULE_2__.providerConfigFromInit)
/* harmony export */ });
/* harmony import */ var _fromContainerMetadata__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(4313);
/* harmony import */ var _fromInstanceMetadata__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(4318);
/* harmony import */ var _remoteProvider_RemoteProviderInit__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(4316);
/* harmony import */ var _remoteProvider_httpRequest__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(4314);
/* harmony import */ var _utils_getInstanceMetadataEndpoint__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(4320);
/* harmony import */ var _config_Endpoint__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(4321);









/***/ }),

/***/ 4315:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   fromImdsCredentials: () => (/* binding */ fromImdsCredentials),
/* harmony export */   isImdsCredentials: () => (/* binding */ isImdsCredentials)
/* harmony export */ });
const isImdsCredentials = (arg) => Boolean(arg) &&
    typeof arg === "object" &&
    typeof arg.AccessKeyId === "string" &&
    typeof arg.SecretAccessKey === "string" &&
    typeof arg.Token === "string" &&
    typeof arg.Expiration === "string";
const fromImdsCredentials = (creds) => ({
    accessKeyId: creds.AccessKeyId,
    secretAccessKey: creds.SecretAccessKey,
    sessionToken: creds.Token,
    expiration: new Date(creds.Expiration),
    ...(creds.AccountId && { accountId: creds.AccountId }),
});


/***/ }),

/***/ 4316:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   DEFAULT_MAX_RETRIES: () => (/* binding */ DEFAULT_MAX_RETRIES),
/* harmony export */   DEFAULT_TIMEOUT: () => (/* binding */ DEFAULT_TIMEOUT),
/* harmony export */   providerConfigFromInit: () => (/* binding */ providerConfigFromInit)
/* harmony export */ });
const DEFAULT_TIMEOUT = 1000;
const DEFAULT_MAX_RETRIES = 0;
const providerConfigFromInit = ({ maxRetries = DEFAULT_MAX_RETRIES, timeout = DEFAULT_TIMEOUT, }) => ({ maxRetries, timeout });


/***/ }),

/***/ 4314:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   httpRequest: () => (/* binding */ httpRequest)
/* harmony export */ });
/* harmony import */ var _smithy_property_provider__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(3033);
/* harmony import */ var buffer__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(719);
/* harmony import */ var buffer__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(buffer__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var http__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2175);
/* harmony import */ var http__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(http__WEBPACK_IMPORTED_MODULE_1__);



function httpRequest(options) {
    return new Promise((resolve, reject) => {
        const req = (0,http__WEBPACK_IMPORTED_MODULE_1__.request)({
            method: "GET",
            ...options,
            hostname: options.hostname?.replace(/^\[(.+)\]$/, "$1"),
        });
        req.on("error", (err) => {
            reject(Object.assign(new _smithy_property_provider__WEBPACK_IMPORTED_MODULE_2__.ProviderError("Unable to connect to instance metadata service"), err));
            req.destroy();
        });
        req.on("timeout", () => {
            reject(new _smithy_property_provider__WEBPACK_IMPORTED_MODULE_2__.ProviderError("TimeoutError from instance metadata service"));
            req.destroy();
        });
        req.on("response", (res) => {
            const { statusCode = 400 } = res;
            if (statusCode < 200 || 300 <= statusCode) {
                reject(Object.assign(new _smithy_property_provider__WEBPACK_IMPORTED_MODULE_2__.ProviderError("Error response received from instance metadata service"), { statusCode }));
                req.destroy();
            }
            const chunks = [];
            res.on("data", (chunk) => {
                chunks.push(chunk);
            });
            res.on("end", () => {
                resolve(buffer__WEBPACK_IMPORTED_MODULE_0__.Buffer.concat(chunks));
                req.destroy();
            });
        });
        req.end();
    });
}


/***/ }),

/***/ 4317:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   retry: () => (/* binding */ retry)
/* harmony export */ });
const retry = (toRetry, maxRetries) => {
    let promise = toRetry();
    for (let i = 0; i < maxRetries; i++) {
        promise = promise.catch(toRetry);
    }
    return promise;
};


/***/ }),

/***/ 4326:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getExtendedInstanceMetadataCredentials: () => (/* binding */ getExtendedInstanceMetadataCredentials)
/* harmony export */ });
const STATIC_STABILITY_REFRESH_INTERVAL_SECONDS = 5 * 60;
const STATIC_STABILITY_REFRESH_INTERVAL_JITTER_WINDOW_SECONDS = 5 * 60;
const STATIC_STABILITY_DOC_URL = "https://docs.aws.amazon.com/sdkref/latest/guide/feature-static-credentials.html";
const getExtendedInstanceMetadataCredentials = (credentials, logger) => {
    const refreshInterval = STATIC_STABILITY_REFRESH_INTERVAL_SECONDS +
        Math.floor(Math.random() * STATIC_STABILITY_REFRESH_INTERVAL_JITTER_WINDOW_SECONDS);
    const newExpiration = new Date(Date.now() + refreshInterval * 1000);
    logger.warn("Attempting credential expiration extension due to a credential service availability issue. A refresh of these " +
        `credentials will be attempted after ${new Date(newExpiration)}.\nFor more information, please visit: ` +
        STATIC_STABILITY_DOC_URL);
    const originalExpiration = credentials.originalExpiration ?? credentials.expiration;
    return {
        ...credentials,
        ...(originalExpiration ? { originalExpiration } : {}),
        expiration: newExpiration,
    };
};


/***/ }),

/***/ 4320:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getInstanceMetadataEndpoint: () => (/* binding */ getInstanceMetadataEndpoint)
/* harmony export */ });
/* harmony import */ var _smithy_node_config_provider__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3029);
/* harmony import */ var _smithy_url_parser__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2974);
/* harmony import */ var _config_Endpoint__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(4321);
/* harmony import */ var _config_EndpointConfigOptions__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(4322);
/* harmony import */ var _config_EndpointMode__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(4323);
/* harmony import */ var _config_EndpointModeConfigOptions__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(4324);






const getInstanceMetadataEndpoint = async () => (0,_smithy_url_parser__WEBPACK_IMPORTED_MODULE_0__.parseUrl)((await getFromEndpointConfig()) || (await getFromEndpointModeConfig()));
const getFromEndpointConfig = async () => (0,_smithy_node_config_provider__WEBPACK_IMPORTED_MODULE_1__.loadConfig)(_config_EndpointConfigOptions__WEBPACK_IMPORTED_MODULE_2__.ENDPOINT_CONFIG_OPTIONS)();
const getFromEndpointModeConfig = async () => {
    const endpointMode = await (0,_smithy_node_config_provider__WEBPACK_IMPORTED_MODULE_1__.loadConfig)(_config_EndpointModeConfigOptions__WEBPACK_IMPORTED_MODULE_3__.ENDPOINT_MODE_CONFIG_OPTIONS)();
    switch (endpointMode) {
        case _config_EndpointMode__WEBPACK_IMPORTED_MODULE_4__.EndpointMode.IPv4:
            return _config_Endpoint__WEBPACK_IMPORTED_MODULE_5__.Endpoint.IPv4;
        case _config_EndpointMode__WEBPACK_IMPORTED_MODULE_4__.EndpointMode.IPv6:
            return _config_Endpoint__WEBPACK_IMPORTED_MODULE_5__.Endpoint.IPv6;
        default:
            throw new Error(`Unsupported endpoint mode: ${endpointMode}.` + ` Select from ${Object.values(_config_EndpointMode__WEBPACK_IMPORTED_MODULE_4__.EndpointMode)}`);
    }
};


/***/ }),

/***/ 4325:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   staticStabilityProvider: () => (/* binding */ staticStabilityProvider)
/* harmony export */ });
/* harmony import */ var _getExtendedInstanceMetadataCredentials__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(4326);

const staticStabilityProvider = (provider, options = {}) => {
    const logger = options?.logger || console;
    let pastCredentials;
    return async () => {
        let credentials;
        try {
            credentials = await provider();
            if (credentials.expiration && credentials.expiration.getTime() < Date.now()) {
                credentials = (0,_getExtendedInstanceMetadataCredentials__WEBPACK_IMPORTED_MODULE_0__.getExtendedInstanceMetadataCredentials)(credentials, logger);
            }
        }
        catch (e) {
            if (pastCredentials) {
                logger.warn("Credential renew failed: ", e);
                credentials = (0,_getExtendedInstanceMetadataCredentials__WEBPACK_IMPORTED_MODULE_0__.getExtendedInstanceMetadataCredentials)(pastCredentials, logger);
            }
            else {
                throw e;
            }
        }
        pastCredentials = credentials;
        return credentials;
    };
};


/***/ })

};
;