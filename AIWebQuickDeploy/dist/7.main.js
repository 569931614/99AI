"use strict";
exports.id = 7;
exports.ids = [7];
exports.modules = {

/***/ 4347:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   fromIni: () => (/* binding */ fromIni)
/* harmony export */ });
/* harmony import */ var _smithy_shared_ini_file_loader__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(4340);
/* harmony import */ var _smithy_shared_ini_file_loader__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(3035);
/* harmony import */ var _resolveProfileData__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(4348);


const fromIni = (_init = {}) => async ({ callerClientConfig } = {}) => {
    const init = {
        ..._init,
        parentClientConfig: {
            ...callerClientConfig,
            ..._init.parentClientConfig,
        },
    };
    init.logger?.debug("@aws-sdk/credential-provider-ini - fromIni");
    const profiles = await (0,_smithy_shared_ini_file_loader__WEBPACK_IMPORTED_MODULE_0__.parseKnownFiles)(init);
    return (0,_resolveProfileData__WEBPACK_IMPORTED_MODULE_1__.resolveProfileData)((0,_smithy_shared_ini_file_loader__WEBPACK_IMPORTED_MODULE_2__.getProfileName)({
        profile: _init.profile ?? callerClientConfig?.profile,
    }), profiles, init);
};


/***/ }),

/***/ 4346:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   fromIni: () => (/* reexport safe */ _fromIni__WEBPACK_IMPORTED_MODULE_0__.fromIni)
/* harmony export */ });
/* harmony import */ var _fromIni__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(4347);



/***/ }),

/***/ 4349:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   isAssumeRoleProfile: () => (/* binding */ isAssumeRoleProfile),
/* harmony export */   resolveAssumeRoleCredentials: () => (/* binding */ resolveAssumeRoleCredentials)
/* harmony export */ });
/* harmony import */ var _aws_sdk_core_client__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(3069);
/* harmony import */ var _smithy_property_provider__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3032);
/* harmony import */ var _smithy_shared_ini_file_loader__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3035);
/* harmony import */ var _resolveCredentialSource__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(4350);
/* harmony import */ var _resolveProfileData__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(4348);





const isAssumeRoleProfile = (arg, { profile = "default", logger } = {}) => {
    return (Boolean(arg) &&
        typeof arg === "object" &&
        typeof arg.role_arn === "string" &&
        ["undefined", "string"].indexOf(typeof arg.role_session_name) > -1 &&
        ["undefined", "string"].indexOf(typeof arg.external_id) > -1 &&
        ["undefined", "string"].indexOf(typeof arg.mfa_serial) > -1 &&
        (isAssumeRoleWithSourceProfile(arg, { profile, logger }) || isCredentialSourceProfile(arg, { profile, logger })));
};
const isAssumeRoleWithSourceProfile = (arg, { profile, logger }) => {
    const withSourceProfile = typeof arg.source_profile === "string" && typeof arg.credential_source === "undefined";
    if (withSourceProfile) {
        logger?.debug?.(`    ${profile} isAssumeRoleWithSourceProfile source_profile=${arg.source_profile}`);
    }
    return withSourceProfile;
};
const isCredentialSourceProfile = (arg, { profile, logger }) => {
    const withProviderProfile = typeof arg.credential_source === "string" && typeof arg.source_profile === "undefined";
    if (withProviderProfile) {
        logger?.debug?.(`    ${profile} isCredentialSourceProfile credential_source=${arg.credential_source}`);
    }
    return withProviderProfile;
};
const resolveAssumeRoleCredentials = async (profileName, profiles, options, visitedProfiles = {}) => {
    options.logger?.debug("@aws-sdk/credential-provider-ini - resolveAssumeRoleCredentials (STS)");
    const profileData = profiles[profileName];
    const { source_profile, region } = profileData;
    if (!options.roleAssumer) {
        const { getDefaultRoleAssumer } = await __webpack_require__.e(/* import() */ 11).then(__webpack_require__.bind(__webpack_require__, 4404));
        options.roleAssumer = getDefaultRoleAssumer({
            ...options.clientConfig,
            credentialProviderLogger: options.logger,
            parentClientConfig: {
                ...options?.parentClientConfig,
                region: region ?? options?.parentClientConfig?.region,
            },
        }, options.clientPlugins);
    }
    if (source_profile && source_profile in visitedProfiles) {
        throw new _smithy_property_provider__WEBPACK_IMPORTED_MODULE_0__.CredentialsProviderError(`Detected a cycle attempting to resolve credentials for profile` +
            ` ${(0,_smithy_shared_ini_file_loader__WEBPACK_IMPORTED_MODULE_1__.getProfileName)(options)}. Profiles visited: ` +
            Object.keys(visitedProfiles).join(", "), { logger: options.logger });
    }
    options.logger?.debug(`@aws-sdk/credential-provider-ini - finding credential resolver using ${source_profile ? `source_profile=[${source_profile}]` : `profile=[${profileName}]`}`);
    const sourceCredsProvider = source_profile
        ? (0,_resolveProfileData__WEBPACK_IMPORTED_MODULE_2__.resolveProfileData)(source_profile, profiles, options, {
            ...visitedProfiles,
            [source_profile]: true,
        }, isCredentialSourceWithoutRoleArn(profiles[source_profile] ?? {}))
        : (await (0,_resolveCredentialSource__WEBPACK_IMPORTED_MODULE_3__.resolveCredentialSource)(profileData.credential_source, profileName, options.logger)(options))();
    if (isCredentialSourceWithoutRoleArn(profileData)) {
        return sourceCredsProvider.then((creds) => (0,_aws_sdk_core_client__WEBPACK_IMPORTED_MODULE_4__.setCredentialFeature)(creds, "CREDENTIALS_PROFILE_SOURCE_PROFILE", "o"));
    }
    else {
        const params = {
            RoleArn: profileData.role_arn,
            RoleSessionName: profileData.role_session_name || `aws-sdk-js-${Date.now()}`,
            ExternalId: profileData.external_id,
            DurationSeconds: parseInt(profileData.duration_seconds || "3600", 10),
        };
        const { mfa_serial } = profileData;
        if (mfa_serial) {
            if (!options.mfaCodeProvider) {
                throw new _smithy_property_provider__WEBPACK_IMPORTED_MODULE_0__.CredentialsProviderError(`Profile ${profileName} requires multi-factor authentication, but no MFA code callback was provided.`, { logger: options.logger, tryNextLink: false });
            }
            params.SerialNumber = mfa_serial;
            params.TokenCode = await options.mfaCodeProvider(mfa_serial);
        }
        const sourceCreds = await sourceCredsProvider;
        return options.roleAssumer(sourceCreds, params).then((creds) => (0,_aws_sdk_core_client__WEBPACK_IMPORTED_MODULE_4__.setCredentialFeature)(creds, "CREDENTIALS_PROFILE_SOURCE_PROFILE", "o"));
    }
};
const isCredentialSourceWithoutRoleArn = (section) => {
    return !section.role_arn && !!section.credential_source;
};


/***/ }),

/***/ 4350:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   resolveCredentialSource: () => (/* binding */ resolveCredentialSource)
/* harmony export */ });
/* harmony import */ var _aws_sdk_core_client__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(3069);
/* harmony import */ var _smithy_property_provider__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3039);
/* harmony import */ var _smithy_property_provider__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3032);


const resolveCredentialSource = (credentialSource, profileName, logger) => {
    const sourceProvidersMap = {
        EcsContainer: async (options) => {
            const { fromHttp } = await __webpack_require__.e(/* import() */ 8).then(__webpack_require__.bind(__webpack_require__, 4363));
            const { fromContainerMetadata } = await __webpack_require__.e(/* import() */ 1).then(__webpack_require__.bind(__webpack_require__, 4312));
            logger?.debug("@aws-sdk/credential-provider-ini - credential_source is EcsContainer");
            return async () => (0,_smithy_property_provider__WEBPACK_IMPORTED_MODULE_0__.chain)(fromHttp(options ?? {}), fromContainerMetadata(options))().then(setNamedProvider);
        },
        Ec2InstanceMetadata: async (options) => {
            logger?.debug("@aws-sdk/credential-provider-ini - credential_source is Ec2InstanceMetadata");
            const { fromInstanceMetadata } = await __webpack_require__.e(/* import() */ 1).then(__webpack_require__.bind(__webpack_require__, 4312));
            return async () => fromInstanceMetadata(options)().then(setNamedProvider);
        },
        Environment: async (options) => {
            logger?.debug("@aws-sdk/credential-provider-ini - credential_source is Environment");
            const { fromEnv } = await __webpack_require__.e(/* import() */ 12).then(__webpack_require__.bind(__webpack_require__, 4424));
            return async () => fromEnv(options)().then(setNamedProvider);
        },
    };
    if (credentialSource in sourceProvidersMap) {
        return sourceProvidersMap[credentialSource];
    }
    else {
        throw new _smithy_property_provider__WEBPACK_IMPORTED_MODULE_1__.CredentialsProviderError(`Unsupported credential source in profile ${profileName}. Got ${credentialSource}, ` +
            `expected EcsContainer or Ec2InstanceMetadata or Environment.`, { logger });
    }
};
const setNamedProvider = (creds) => (0,_aws_sdk_core_client__WEBPACK_IMPORTED_MODULE_2__.setCredentialFeature)(creds, "CREDENTIALS_PROFILE_NAMED_PROVIDER", "p");


/***/ }),

/***/ 4351:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   isProcessProfile: () => (/* binding */ isProcessProfile),
/* harmony export */   resolveProcessCredentials: () => (/* binding */ resolveProcessCredentials)
/* harmony export */ });
/* harmony import */ var _aws_sdk_core_client__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3069);

const isProcessProfile = (arg) => Boolean(arg) && typeof arg === "object" && typeof arg.credential_process === "string";
const resolveProcessCredentials = async (options, profile) => __webpack_require__.e(/* import() */ 5).then(__webpack_require__.bind(__webpack_require__, 4355)).then(({ fromProcess }) => fromProcess({
    ...options,
    profile,
})().then((creds) => (0,_aws_sdk_core_client__WEBPACK_IMPORTED_MODULE_0__.setCredentialFeature)(creds, "CREDENTIALS_PROFILE_PROCESS", "v")));


/***/ }),

/***/ 4348:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   resolveProfileData: () => (/* binding */ resolveProfileData)
/* harmony export */ });
/* harmony import */ var _smithy_property_provider__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(3032);
/* harmony import */ var _resolveAssumeRoleCredentials__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(4349);
/* harmony import */ var _resolveProcessCredentials__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(4351);
/* harmony import */ var _resolveSsoCredentials__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(4352);
/* harmony import */ var _resolveStaticCredentials__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(4353);
/* harmony import */ var _resolveWebIdentityCredentials__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(4354);






const resolveProfileData = async (profileName, profiles, options, visitedProfiles = {}, isAssumeRoleRecursiveCall = false) => {
    const data = profiles[profileName];
    if (Object.keys(visitedProfiles).length > 0 && (0,_resolveStaticCredentials__WEBPACK_IMPORTED_MODULE_0__.isStaticCredsProfile)(data)) {
        return (0,_resolveStaticCredentials__WEBPACK_IMPORTED_MODULE_0__.resolveStaticCredentials)(data, options);
    }
    if (isAssumeRoleRecursiveCall || (0,_resolveAssumeRoleCredentials__WEBPACK_IMPORTED_MODULE_1__.isAssumeRoleProfile)(data, { profile: profileName, logger: options.logger })) {
        return (0,_resolveAssumeRoleCredentials__WEBPACK_IMPORTED_MODULE_1__.resolveAssumeRoleCredentials)(profileName, profiles, options, visitedProfiles);
    }
    if ((0,_resolveStaticCredentials__WEBPACK_IMPORTED_MODULE_0__.isStaticCredsProfile)(data)) {
        return (0,_resolveStaticCredentials__WEBPACK_IMPORTED_MODULE_0__.resolveStaticCredentials)(data, options);
    }
    if ((0,_resolveWebIdentityCredentials__WEBPACK_IMPORTED_MODULE_2__.isWebIdentityProfile)(data)) {
        return (0,_resolveWebIdentityCredentials__WEBPACK_IMPORTED_MODULE_2__.resolveWebIdentityCredentials)(data, options);
    }
    if ((0,_resolveProcessCredentials__WEBPACK_IMPORTED_MODULE_3__.isProcessProfile)(data)) {
        return (0,_resolveProcessCredentials__WEBPACK_IMPORTED_MODULE_3__.resolveProcessCredentials)(options, profileName);
    }
    if ((0,_resolveSsoCredentials__WEBPACK_IMPORTED_MODULE_4__.isSsoProfile)(data)) {
        return await (0,_resolveSsoCredentials__WEBPACK_IMPORTED_MODULE_4__.resolveSsoCredentials)(profileName, data, options);
    }
    throw new _smithy_property_provider__WEBPACK_IMPORTED_MODULE_5__.CredentialsProviderError(`Could not resolve credentials using profile: [${profileName}] in configuration/credentials file(s).`, { logger: options.logger });
};


/***/ }),

/***/ 4352:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   isSsoProfile: () => (/* binding */ isSsoProfile),
/* harmony export */   resolveSsoCredentials: () => (/* binding */ resolveSsoCredentials)
/* harmony export */ });
/* harmony import */ var _aws_sdk_core_client__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3069);

const resolveSsoCredentials = async (profile, profileData, options = {}) => {
    const { fromSSO } = await __webpack_require__.e(/* import() */ 3).then(__webpack_require__.bind(__webpack_require__, 4327));
    return fromSSO({
        profile,
        logger: options.logger,
        parentClientConfig: options.parentClientConfig,
        clientConfig: options.clientConfig,
    })().then((creds) => {
        if (profileData.sso_session) {
            return (0,_aws_sdk_core_client__WEBPACK_IMPORTED_MODULE_0__.setCredentialFeature)(creds, "CREDENTIALS_PROFILE_SSO", "r");
        }
        else {
            return (0,_aws_sdk_core_client__WEBPACK_IMPORTED_MODULE_0__.setCredentialFeature)(creds, "CREDENTIALS_PROFILE_SSO_LEGACY", "t");
        }
    });
};
const isSsoProfile = (arg) => arg &&
    (typeof arg.sso_start_url === "string" ||
        typeof arg.sso_account_id === "string" ||
        typeof arg.sso_session === "string" ||
        typeof arg.sso_region === "string" ||
        typeof arg.sso_role_name === "string");


/***/ }),

/***/ 4353:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   isStaticCredsProfile: () => (/* binding */ isStaticCredsProfile),
/* harmony export */   resolveStaticCredentials: () => (/* binding */ resolveStaticCredentials)
/* harmony export */ });
/* harmony import */ var _aws_sdk_core_client__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3069);

const isStaticCredsProfile = (arg) => Boolean(arg) &&
    typeof arg === "object" &&
    typeof arg.aws_access_key_id === "string" &&
    typeof arg.aws_secret_access_key === "string" &&
    ["undefined", "string"].indexOf(typeof arg.aws_session_token) > -1 &&
    ["undefined", "string"].indexOf(typeof arg.aws_account_id) > -1;
const resolveStaticCredentials = async (profile, options) => {
    options?.logger?.debug("@aws-sdk/credential-provider-ini - resolveStaticCredentials");
    const credentials = {
        accessKeyId: profile.aws_access_key_id,
        secretAccessKey: profile.aws_secret_access_key,
        sessionToken: profile.aws_session_token,
        ...(profile.aws_credential_scope && { credentialScope: profile.aws_credential_scope }),
        ...(profile.aws_account_id && { accountId: profile.aws_account_id }),
    };
    return (0,_aws_sdk_core_client__WEBPACK_IMPORTED_MODULE_0__.setCredentialFeature)(credentials, "CREDENTIALS_PROFILE", "n");
};


/***/ }),

/***/ 4354:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   isWebIdentityProfile: () => (/* binding */ isWebIdentityProfile),
/* harmony export */   resolveWebIdentityCredentials: () => (/* binding */ resolveWebIdentityCredentials)
/* harmony export */ });
/* harmony import */ var _aws_sdk_core_client__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3069);

const isWebIdentityProfile = (arg) => Boolean(arg) &&
    typeof arg === "object" &&
    typeof arg.web_identity_token_file === "string" &&
    typeof arg.role_arn === "string" &&
    ["undefined", "string"].indexOf(typeof arg.role_session_name) > -1;
const resolveWebIdentityCredentials = async (profile, options) => __webpack_require__.e(/* import() */ 6).then(__webpack_require__.bind(__webpack_require__, 4360)).then(({ fromTokenFile }) => fromTokenFile({
    webIdentityTokenFile: profile.web_identity_token_file,
    roleArn: profile.role_arn,
    roleSessionName: profile.role_session_name,
    roleAssumerWithWebIdentity: options.roleAssumerWithWebIdentity,
    logger: options.logger,
    parentClientConfig: options.parentClientConfig,
})().then((creds) => (0,_aws_sdk_core_client__WEBPACK_IMPORTED_MODULE_0__.setCredentialFeature)(creds, "CREDENTIALS_PROFILE_STS_WEB_ID_TOKEN", "q")));


/***/ }),

/***/ 4341:
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

/***/ 4340:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   parseKnownFiles: () => (/* binding */ parseKnownFiles)
/* harmony export */ });
/* harmony import */ var _loadSharedConfigFiles__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3021);
/* harmony import */ var _mergeConfigFiles__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(4341);


const parseKnownFiles = async (init) => {
    const parsedFiles = await (0,_loadSharedConfigFiles__WEBPACK_IMPORTED_MODULE_0__.loadSharedConfigFiles)(init);
    return (0,_mergeConfigFiles__WEBPACK_IMPORTED_MODULE_1__.mergeConfigFiles)(parsedFiles.configFile, parsedFiles.credentialsFile);
};


/***/ })

};
;