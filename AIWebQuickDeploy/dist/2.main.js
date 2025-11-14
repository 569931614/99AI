"use strict";
exports.id = 2;
exports.ids = [2];
exports.modules = {

/***/ 4335:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   fromSSO: () => (/* binding */ fromSSO)
/* harmony export */ });
/* harmony import */ var _smithy_property_provider__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(3032);
/* harmony import */ var _smithy_shared_ini_file_loader__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3035);
/* harmony import */ var _smithy_shared_ini_file_loader__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(4347);
/* harmony import */ var _smithy_shared_ini_file_loader__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(4349);
/* harmony import */ var _isSsoProfile__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(4336);
/* harmony import */ var _resolveSSOCredentials__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(4337);
/* harmony import */ var _validateSsoProfile__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(4352);





const fromSSO = (init = {}) => async ({ callerClientConfig } = {}) => {
    init.logger?.debug("@aws-sdk/credential-provider-sso - fromSSO");
    const { ssoStartUrl, ssoAccountId, ssoRegion, ssoRoleName, ssoSession } = init;
    const { ssoClient } = init;
    const profileName = (0,_smithy_shared_ini_file_loader__WEBPACK_IMPORTED_MODULE_0__.getProfileName)({
        profile: init.profile ?? callerClientConfig?.profile,
    });
    if (!ssoStartUrl && !ssoAccountId && !ssoRegion && !ssoRoleName && !ssoSession) {
        const profiles = await (0,_smithy_shared_ini_file_loader__WEBPACK_IMPORTED_MODULE_1__.parseKnownFiles)(init);
        const profile = profiles[profileName];
        if (!profile) {
            throw new _smithy_property_provider__WEBPACK_IMPORTED_MODULE_2__.CredentialsProviderError(`Profile ${profileName} was not found.`, { logger: init.logger });
        }
        if (!(0,_isSsoProfile__WEBPACK_IMPORTED_MODULE_3__.isSsoProfile)(profile)) {
            throw new _smithy_property_provider__WEBPACK_IMPORTED_MODULE_2__.CredentialsProviderError(`Profile ${profileName} is not configured with SSO credentials.`, {
                logger: init.logger,
            });
        }
        if (profile?.sso_session) {
            const ssoSessions = await (0,_smithy_shared_ini_file_loader__WEBPACK_IMPORTED_MODULE_4__.loadSsoSessionData)(init);
            const session = ssoSessions[profile.sso_session];
            const conflictMsg = ` configurations in profile ${profileName} and sso-session ${profile.sso_session}`;
            if (ssoRegion && ssoRegion !== session.sso_region) {
                throw new _smithy_property_provider__WEBPACK_IMPORTED_MODULE_2__.CredentialsProviderError(`Conflicting SSO region` + conflictMsg, {
                    tryNextLink: false,
                    logger: init.logger,
                });
            }
            if (ssoStartUrl && ssoStartUrl !== session.sso_start_url) {
                throw new _smithy_property_provider__WEBPACK_IMPORTED_MODULE_2__.CredentialsProviderError(`Conflicting SSO start_url` + conflictMsg, {
                    tryNextLink: false,
                    logger: init.logger,
                });
            }
            profile.sso_region = session.sso_region;
            profile.sso_start_url = session.sso_start_url;
        }
        const { sso_start_url, sso_account_id, sso_region, sso_role_name, sso_session } = (0,_validateSsoProfile__WEBPACK_IMPORTED_MODULE_5__.validateSsoProfile)(profile, init.logger);
        return (0,_resolveSSOCredentials__WEBPACK_IMPORTED_MODULE_6__.resolveSSOCredentials)({
            ssoStartUrl: sso_start_url,
            ssoSession: sso_session,
            ssoAccountId: sso_account_id,
            ssoRegion: sso_region,
            ssoRoleName: sso_role_name,
            ssoClient: ssoClient,
            clientConfig: init.clientConfig,
            parentClientConfig: init.parentClientConfig,
            profile: profileName,
            filepath: init.filepath,
            configFilepath: init.configFilepath,
            ignoreCache: init.ignoreCache,
            logger: init.logger,
        });
    }
    else if (!ssoStartUrl || !ssoAccountId || !ssoRegion || !ssoRoleName) {
        throw new _smithy_property_provider__WEBPACK_IMPORTED_MODULE_2__.CredentialsProviderError("Incomplete configuration. The fromSSO() argument hash must include " +
            '"ssoStartUrl", "ssoAccountId", "ssoRegion", "ssoRoleName"', { tryNextLink: false, logger: init.logger });
    }
    else {
        return (0,_resolveSSOCredentials__WEBPACK_IMPORTED_MODULE_6__.resolveSSOCredentials)({
            ssoStartUrl,
            ssoSession,
            ssoAccountId,
            ssoRegion,
            ssoRoleName,
            ssoClient,
            clientConfig: init.clientConfig,
            parentClientConfig: init.parentClientConfig,
            profile: profileName,
            filepath: init.filepath,
            configFilepath: init.configFilepath,
            ignoreCache: init.ignoreCache,
            logger: init.logger,
        });
    }
};


/***/ }),

/***/ 4334:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   fromSSO: () => (/* reexport safe */ _fromSSO__WEBPACK_IMPORTED_MODULE_0__.fromSSO),
/* harmony export */   isSsoProfile: () => (/* reexport safe */ _isSsoProfile__WEBPACK_IMPORTED_MODULE_1__.isSsoProfile),
/* harmony export */   validateSsoProfile: () => (/* reexport safe */ _validateSsoProfile__WEBPACK_IMPORTED_MODULE_2__.validateSsoProfile)
/* harmony export */ });
/* harmony import */ var _fromSSO__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(4335);
/* harmony import */ var _isSsoProfile__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(4336);
/* harmony import */ var _validateSsoProfile__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(4352);






/***/ }),

/***/ 4336:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   isSsoProfile: () => (/* binding */ isSsoProfile)
/* harmony export */ });
const isSsoProfile = (arg) => arg &&
    (typeof arg.sso_start_url === "string" ||
        typeof arg.sso_account_id === "string" ||
        typeof arg.sso_session === "string" ||
        typeof arg.sso_region === "string" ||
        typeof arg.sso_role_name === "string");


/***/ }),

/***/ 4337:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   resolveSSOCredentials: () => (/* binding */ resolveSSOCredentials)
/* harmony export */ });
/* harmony import */ var _aws_sdk_core_client__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(3069);
/* harmony import */ var _aws_sdk_token_providers__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(4338);
/* harmony import */ var _smithy_property_provider__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3032);
/* harmony import */ var _smithy_shared_ini_file_loader__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(4351);




const SHOULD_FAIL_CREDENTIAL_CHAIN = false;
const resolveSSOCredentials = async ({ ssoStartUrl, ssoSession, ssoAccountId, ssoRegion, ssoRoleName, ssoClient, clientConfig, parentClientConfig, profile, filepath, configFilepath, ignoreCache, logger, }) => {
    let token;
    const refreshMessage = `To refresh this SSO session run aws sso login with the corresponding profile.`;
    if (ssoSession) {
        try {
            const _token = await (0,_aws_sdk_token_providers__WEBPACK_IMPORTED_MODULE_0__.fromSso)({
                profile,
                filepath,
                configFilepath,
                ignoreCache,
            })();
            token = {
                accessToken: _token.token,
                expiresAt: new Date(_token.expiration).toISOString(),
            };
        }
        catch (e) {
            throw new _smithy_property_provider__WEBPACK_IMPORTED_MODULE_1__.CredentialsProviderError(e.message, {
                tryNextLink: SHOULD_FAIL_CREDENTIAL_CHAIN,
                logger,
            });
        }
    }
    else {
        try {
            token = await (0,_smithy_shared_ini_file_loader__WEBPACK_IMPORTED_MODULE_2__.getSSOTokenFromFile)(ssoStartUrl);
        }
        catch (e) {
            throw new _smithy_property_provider__WEBPACK_IMPORTED_MODULE_1__.CredentialsProviderError(`The SSO session associated with this profile is invalid. ${refreshMessage}`, {
                tryNextLink: SHOULD_FAIL_CREDENTIAL_CHAIN,
                logger,
            });
        }
    }
    if (new Date(token.expiresAt).getTime() - Date.now() <= 0) {
        throw new _smithy_property_provider__WEBPACK_IMPORTED_MODULE_1__.CredentialsProviderError(`The SSO session associated with this profile has expired. ${refreshMessage}`, {
            tryNextLink: SHOULD_FAIL_CREDENTIAL_CHAIN,
            logger,
        });
    }
    const { accessToken } = token;
    const { SSOClient, GetRoleCredentialsCommand } = await __webpack_require__.e(/* import() */ 9).then(__webpack_require__.bind(__webpack_require__, 4375));
    const sso = ssoClient ||
        new SSOClient(Object.assign({}, clientConfig ?? {}, {
            logger: clientConfig?.logger ?? parentClientConfig?.logger,
            region: clientConfig?.region ?? ssoRegion,
        }));
    let ssoResp;
    try {
        ssoResp = await sso.send(new GetRoleCredentialsCommand({
            accountId: ssoAccountId,
            roleName: ssoRoleName,
            accessToken,
        }));
    }
    catch (e) {
        throw new _smithy_property_provider__WEBPACK_IMPORTED_MODULE_1__.CredentialsProviderError(e, {
            tryNextLink: SHOULD_FAIL_CREDENTIAL_CHAIN,
            logger,
        });
    }
    const { roleCredentials: { accessKeyId, secretAccessKey, sessionToken, expiration, credentialScope, accountId } = {}, } = ssoResp;
    if (!accessKeyId || !secretAccessKey || !sessionToken || !expiration) {
        throw new _smithy_property_provider__WEBPACK_IMPORTED_MODULE_1__.CredentialsProviderError("SSO returns an invalid temporary credential.", {
            tryNextLink: SHOULD_FAIL_CREDENTIAL_CHAIN,
            logger,
        });
    }
    const credentials = {
        accessKeyId,
        secretAccessKey,
        sessionToken,
        expiration: new Date(expiration),
        ...(credentialScope && { credentialScope }),
        ...(accountId && { accountId }),
    };
    if (ssoSession) {
        (0,_aws_sdk_core_client__WEBPACK_IMPORTED_MODULE_3__.setCredentialFeature)(credentials, "CREDENTIALS_SSO", "s");
    }
    else {
        (0,_aws_sdk_core_client__WEBPACK_IMPORTED_MODULE_3__.setCredentialFeature)(credentials, "CREDENTIALS_SSO_LEGACY", "u");
    }
    return credentials;
};


/***/ }),

/***/ 4352:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   validateSsoProfile: () => (/* binding */ validateSsoProfile)
/* harmony export */ });
/* harmony import */ var _smithy_property_provider__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3032);

const validateSsoProfile = (profile, logger) => {
    const { sso_start_url, sso_account_id, sso_region, sso_role_name } = profile;
    if (!sso_start_url || !sso_account_id || !sso_region || !sso_role_name) {
        throw new _smithy_property_provider__WEBPACK_IMPORTED_MODULE_0__.CredentialsProviderError(`Profile is configured with invalid SSO credentials. Required parameters "sso_account_id", ` +
            `"sso_region", "sso_role_name", "sso_start_url". Got ${Object.keys(profile).join(", ")}\nReference: https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html`, { tryNextLink: false, logger });
    }
    return profile;
};


/***/ }),

/***/ 4339:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   EXPIRE_WINDOW_MS: () => (/* binding */ EXPIRE_WINDOW_MS),
/* harmony export */   REFRESH_MESSAGE: () => (/* binding */ REFRESH_MESSAGE)
/* harmony export */ });
const EXPIRE_WINDOW_MS = 5 * 60 * 1000;
const REFRESH_MESSAGE = `To refresh this SSO session run 'aws sso login' with the corresponding profile.`;


/***/ }),

/***/ 4338:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   fromSso: () => (/* binding */ fromSso)
/* harmony export */ });
/* harmony import */ var _smithy_property_provider__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(4343);
/* harmony import */ var _smithy_shared_ini_file_loader__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(4347);
/* harmony import */ var _smithy_shared_ini_file_loader__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3035);
/* harmony import */ var _smithy_shared_ini_file_loader__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(4349);
/* harmony import */ var _smithy_shared_ini_file_loader__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(4351);
/* harmony import */ var _constants__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(4339);
/* harmony import */ var _getNewSsoOidcToken__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(4340);
/* harmony import */ var _validateTokenExpiry__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(4342);
/* harmony import */ var _validateTokenKey__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(4344);
/* harmony import */ var _writeSSOTokenToFile__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(4345);







const lastRefreshAttemptTime = new Date(0);
const fromSso = (_init = {}) => async ({ callerClientConfig } = {}) => {
    const init = {
        ..._init,
        parentClientConfig: {
            ...callerClientConfig,
            ..._init.parentClientConfig,
        },
    };
    init.logger?.debug("@aws-sdk/token-providers - fromSso");
    const profiles = await (0,_smithy_shared_ini_file_loader__WEBPACK_IMPORTED_MODULE_0__.parseKnownFiles)(init);
    const profileName = (0,_smithy_shared_ini_file_loader__WEBPACK_IMPORTED_MODULE_1__.getProfileName)({
        profile: init.profile ?? callerClientConfig?.profile,
    });
    const profile = profiles[profileName];
    if (!profile) {
        throw new _smithy_property_provider__WEBPACK_IMPORTED_MODULE_2__.TokenProviderError(`Profile '${profileName}' could not be found in shared credentials file.`, false);
    }
    else if (!profile["sso_session"]) {
        throw new _smithy_property_provider__WEBPACK_IMPORTED_MODULE_2__.TokenProviderError(`Profile '${profileName}' is missing required property 'sso_session'.`);
    }
    const ssoSessionName = profile["sso_session"];
    const ssoSessions = await (0,_smithy_shared_ini_file_loader__WEBPACK_IMPORTED_MODULE_3__.loadSsoSessionData)(init);
    const ssoSession = ssoSessions[ssoSessionName];
    if (!ssoSession) {
        throw new _smithy_property_provider__WEBPACK_IMPORTED_MODULE_2__.TokenProviderError(`Sso session '${ssoSessionName}' could not be found in shared credentials file.`, false);
    }
    for (const ssoSessionRequiredKey of ["sso_start_url", "sso_region"]) {
        if (!ssoSession[ssoSessionRequiredKey]) {
            throw new _smithy_property_provider__WEBPACK_IMPORTED_MODULE_2__.TokenProviderError(`Sso session '${ssoSessionName}' is missing required property '${ssoSessionRequiredKey}'.`, false);
        }
    }
    const ssoStartUrl = ssoSession["sso_start_url"];
    const ssoRegion = ssoSession["sso_region"];
    let ssoToken;
    try {
        ssoToken = await (0,_smithy_shared_ini_file_loader__WEBPACK_IMPORTED_MODULE_4__.getSSOTokenFromFile)(ssoSessionName);
    }
    catch (e) {
        throw new _smithy_property_provider__WEBPACK_IMPORTED_MODULE_2__.TokenProviderError(`The SSO session token associated with profile=${profileName} was not found or is invalid. ${_constants__WEBPACK_IMPORTED_MODULE_5__.REFRESH_MESSAGE}`, false);
    }
    (0,_validateTokenKey__WEBPACK_IMPORTED_MODULE_6__.validateTokenKey)("accessToken", ssoToken.accessToken);
    (0,_validateTokenKey__WEBPACK_IMPORTED_MODULE_6__.validateTokenKey)("expiresAt", ssoToken.expiresAt);
    const { accessToken, expiresAt } = ssoToken;
    const existingToken = { token: accessToken, expiration: new Date(expiresAt) };
    if (existingToken.expiration.getTime() - Date.now() > _constants__WEBPACK_IMPORTED_MODULE_5__.EXPIRE_WINDOW_MS) {
        return existingToken;
    }
    if (Date.now() - lastRefreshAttemptTime.getTime() < 30 * 1000) {
        (0,_validateTokenExpiry__WEBPACK_IMPORTED_MODULE_7__.validateTokenExpiry)(existingToken);
        return existingToken;
    }
    (0,_validateTokenKey__WEBPACK_IMPORTED_MODULE_6__.validateTokenKey)("clientId", ssoToken.clientId, true);
    (0,_validateTokenKey__WEBPACK_IMPORTED_MODULE_6__.validateTokenKey)("clientSecret", ssoToken.clientSecret, true);
    (0,_validateTokenKey__WEBPACK_IMPORTED_MODULE_6__.validateTokenKey)("refreshToken", ssoToken.refreshToken, true);
    try {
        lastRefreshAttemptTime.setTime(Date.now());
        const newSsoOidcToken = await (0,_getNewSsoOidcToken__WEBPACK_IMPORTED_MODULE_8__.getNewSsoOidcToken)(ssoToken, ssoRegion, init);
        (0,_validateTokenKey__WEBPACK_IMPORTED_MODULE_6__.validateTokenKey)("accessToken", newSsoOidcToken.accessToken);
        (0,_validateTokenKey__WEBPACK_IMPORTED_MODULE_6__.validateTokenKey)("expiresIn", newSsoOidcToken.expiresIn);
        const newTokenExpiration = new Date(Date.now() + newSsoOidcToken.expiresIn * 1000);
        try {
            await (0,_writeSSOTokenToFile__WEBPACK_IMPORTED_MODULE_9__.writeSSOTokenToFile)(ssoSessionName, {
                ...ssoToken,
                accessToken: newSsoOidcToken.accessToken,
                expiresAt: newTokenExpiration.toISOString(),
                refreshToken: newSsoOidcToken.refreshToken,
            });
        }
        catch (error) {
        }
        return {
            token: newSsoOidcToken.accessToken,
            expiration: newTokenExpiration,
        };
    }
    catch (error) {
        (0,_validateTokenExpiry__WEBPACK_IMPORTED_MODULE_7__.validateTokenExpiry)(existingToken);
        return existingToken;
    }
};


/***/ }),

/***/ 4340:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getNewSsoOidcToken: () => (/* binding */ getNewSsoOidcToken)
/* harmony export */ });
/* harmony import */ var _getSsoOidcClient__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(4341);

const getNewSsoOidcToken = async (ssoToken, ssoRegion, init = {}) => {
    const { CreateTokenCommand } = await __webpack_require__.e(/* import() */ 10).then(__webpack_require__.bind(__webpack_require__, 4393));
    const ssoOidcClient = await (0,_getSsoOidcClient__WEBPACK_IMPORTED_MODULE_0__.getSsoOidcClient)(ssoRegion, init);
    return ssoOidcClient.send(new CreateTokenCommand({
        clientId: ssoToken.clientId,
        clientSecret: ssoToken.clientSecret,
        refreshToken: ssoToken.refreshToken,
        grantType: "refresh_token",
    }));
};


/***/ }),

/***/ 4341:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getSsoOidcClient: () => (/* binding */ getSsoOidcClient)
/* harmony export */ });
const getSsoOidcClient = async (ssoRegion, init = {}) => {
    const { SSOOIDCClient } = await __webpack_require__.e(/* import() */ 10).then(__webpack_require__.bind(__webpack_require__, 4393));
    const ssoOidcClient = new SSOOIDCClient(Object.assign({}, init.clientConfig ?? {}, {
        region: ssoRegion ?? init.clientConfig?.region,
        logger: init.clientConfig?.logger ?? init.parentClientConfig?.logger,
    }));
    return ssoOidcClient;
};


/***/ }),

/***/ 4342:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   validateTokenExpiry: () => (/* binding */ validateTokenExpiry)
/* harmony export */ });
/* harmony import */ var _smithy_property_provider__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(4343);
/* harmony import */ var _constants__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(4339);


const validateTokenExpiry = (token) => {
    if (token.expiration && token.expiration.getTime() < Date.now()) {
        throw new _smithy_property_provider__WEBPACK_IMPORTED_MODULE_0__.TokenProviderError(`Token is expired. ${_constants__WEBPACK_IMPORTED_MODULE_1__.REFRESH_MESSAGE}`, false);
    }
};


/***/ }),

/***/ 4344:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   validateTokenKey: () => (/* binding */ validateTokenKey)
/* harmony export */ });
/* harmony import */ var _smithy_property_provider__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(4343);
/* harmony import */ var _constants__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(4339);


const validateTokenKey = (key, value, forRefresh = false) => {
    if (typeof value === "undefined") {
        throw new _smithy_property_provider__WEBPACK_IMPORTED_MODULE_0__.TokenProviderError(`Value not present for '${key}' in SSO Token${forRefresh ? ". Cannot refresh" : ""}. ${_constants__WEBPACK_IMPORTED_MODULE_1__.REFRESH_MESSAGE}`, false);
    }
};


/***/ }),

/***/ 4345:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   writeSSOTokenToFile: () => (/* binding */ writeSSOTokenToFile)
/* harmony export */ });
/* harmony import */ var _smithy_shared_ini_file_loader__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(4346);
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(673);
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(fs__WEBPACK_IMPORTED_MODULE_0__);


const { writeFile } = fs__WEBPACK_IMPORTED_MODULE_0__.promises;
const writeSSOTokenToFile = (id, ssoToken) => {
    const tokenFilepath = (0,_smithy_shared_ini_file_loader__WEBPACK_IMPORTED_MODULE_1__.getSSOTokenFilepath)(id);
    const tokenString = JSON.stringify(ssoToken, null, 2);
    return writeFile(tokenFilepath, tokenString);
};


/***/ }),

/***/ 4343:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   TokenProviderError: () => (/* binding */ TokenProviderError)
/* harmony export */ });
/* harmony import */ var _ProviderError__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3033);

class TokenProviderError extends _ProviderError__WEBPACK_IMPORTED_MODULE_0__.ProviderError {
    name = "TokenProviderError";
    constructor(message, options = true) {
        super(message, options);
        Object.setPrototypeOf(this, TokenProviderError.prototype);
    }
}


/***/ }),

/***/ 4346:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getSSOTokenFilepath: () => (/* binding */ getSSOTokenFilepath)
/* harmony export */ });
/* harmony import */ var crypto__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(676);
/* harmony import */ var crypto__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(crypto__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(674);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(path__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _getHomeDir__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(3025);



const getSSOTokenFilepath = (id) => {
    const hasher = (0,crypto__WEBPACK_IMPORTED_MODULE_0__.createHash)("sha1");
    const cacheName = hasher.update(id).digest("hex");
    return (0,path__WEBPACK_IMPORTED_MODULE_1__.join)((0,_getHomeDir__WEBPACK_IMPORTED_MODULE_2__.getHomeDir)(), ".aws", "sso", "cache", `${cacheName}.json`);
};


/***/ }),

/***/ 4351:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getSSOTokenFromFile: () => (/* binding */ getSSOTokenFromFile),
/* harmony export */   tokenIntercept: () => (/* binding */ tokenIntercept)
/* harmony export */ });
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(673);
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(fs__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _getSSOTokenFilepath__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(4346);


const { readFile } = fs__WEBPACK_IMPORTED_MODULE_0__.promises;
const tokenIntercept = {};
const getSSOTokenFromFile = async (id) => {
    if (tokenIntercept[id]) {
        return tokenIntercept[id];
    }
    const ssoTokenFilepath = (0,_getSSOTokenFilepath__WEBPACK_IMPORTED_MODULE_1__.getSSOTokenFilepath)(id);
    const ssoTokenText = await readFile(ssoTokenFilepath, "utf8");
    return JSON.parse(ssoTokenText);
};


/***/ }),

/***/ 4350:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getSsoSessionData: () => (/* binding */ getSsoSessionData)
/* harmony export */ });
/* harmony import */ var _smithy_types__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3023);
/* harmony import */ var _loadSharedConfigFiles__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3021);


const getSsoSessionData = (data) => Object.entries(data)
    .filter(([key]) => key.startsWith(_smithy_types__WEBPACK_IMPORTED_MODULE_0__.IniSectionType.SSO_SESSION + _loadSharedConfigFiles__WEBPACK_IMPORTED_MODULE_1__.CONFIG_PREFIX_SEPARATOR))
    .reduce((acc, [key, value]) => ({ ...acc, [key.substring(key.indexOf(_loadSharedConfigFiles__WEBPACK_IMPORTED_MODULE_1__.CONFIG_PREFIX_SEPARATOR) + 1)]: value }), {});


/***/ }),

/***/ 4349:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   loadSsoSessionData: () => (/* binding */ loadSsoSessionData)
/* harmony export */ });
/* harmony import */ var _getConfigFilepath__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3024);
/* harmony import */ var _getSsoSessionData__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(4350);
/* harmony import */ var _parseIni__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(3027);
/* harmony import */ var _slurpFile__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3028);




const swallowError = () => ({});
const loadSsoSessionData = async (init = {}) => (0,_slurpFile__WEBPACK_IMPORTED_MODULE_0__.slurpFile)(init.configFilepath ?? (0,_getConfigFilepath__WEBPACK_IMPORTED_MODULE_1__.getConfigFilepath)())
    .then(_parseIni__WEBPACK_IMPORTED_MODULE_2__.parseIni)
    .then(_getSsoSessionData__WEBPACK_IMPORTED_MODULE_3__.getSsoSessionData)
    .catch(swallowError);


/***/ }),

/***/ 4348:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   mergeConfigFiles: () => (/* binding */ mergeConfigFiles)
/* harmony export */ });
const mergeConfigFiles = (...files) => {
    const merged = {};
    for (const file of files) {
        for (const [key, values] of Object.entries(file)) {
            if (merged[key] !== undefined) {
                Object.assign(merged[key], values);
            }
            else {
                merged[key] = values;
            }
        }
    }
    return merged;
};


/***/ }),

/***/ 4347:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   parseKnownFiles: () => (/* binding */ parseKnownFiles)
/* harmony export */ });
/* harmony import */ var _loadSharedConfigFiles__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3021);
/* harmony import */ var _mergeConfigFiles__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(4348);


const parseKnownFiles = async (init) => {
    const parsedFiles = await (0,_loadSharedConfigFiles__WEBPACK_IMPORTED_MODULE_0__.loadSharedConfigFiles)(init);
    return (0,_mergeConfigFiles__WEBPACK_IMPORTED_MODULE_1__.mergeConfigFiles)(parsedFiles.configFile, parsedFiles.credentialsFile);
};


/***/ })

};
;