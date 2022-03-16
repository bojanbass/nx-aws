"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const github_1 = require("@actions/github");
const core_1 = require("@actions/core");
// eslint-disable-next-line unicorn/better-regex
const packageTagFormat = new RegExp(/^(.+)-(v(([0-9]{1,}\.){2})[0-9]{1,}(-alpha\.[0-9]{1,})?)$/);
// eslint-disable-next-line unicorn/better-regex
const tagFormat = new RegExp(/^v([0-9]{1,}\.){2}[0-9]{1,}(-alpha\.[0-9]{1,})?/);
// eslint-disable-next-line unicorn/better-regex
const releaseFormat = new RegExp(/^v([0-9]{1,}\.){2}[0-9]{1,}$/);
// eslint-disable-next-line unicorn/better-regex
const prereleaseFormat = new RegExp(/^v([0-9]{1,}\.){2}[0-9]{1,}(-alpha\.[0-9]{1,})$/);
// eslint-disable-next-line max-lines-per-function,complexity
function run() {
    try {
        if (github_1.context.payload.repository === undefined) {
            throw new Error('repository missing in the payload');
        }
        const repoName = github_1.context.payload.repository.name;
        const ref = github_1.context.ref;
        core_1.notice(`The repo: ${repoName}`);
        const shortRef = ref.substring(ref.lastIndexOf('/') + 1);
        core_1.notice(`Ref: ${ref}, short ref: ${shortRef}`);
        const tagName = ref.startsWith('refs/tags') ? shortRef : github_1.context.sha;
        const releaseVersion = tagName.startsWith('v') ? tagName.substring(1) : null;
        const { releaseType, tag } = getReleaseTypeAndConfig(ref, tagName);
        core_1.notice(`Tag name: ${tag}`);
        core_1.notice(`Release type: ${releaseType} - ${ref}`);
        core_1.setOutput('tag-name', tagName);
        core_1.setOutput('release-version', releaseVersion);
        core_1.setOutput('release-type', releaseType);
    }
    catch (error) {
        core_1.setFailed(error.message);
    }
}
function getReleaseTypeAndConfig(ref, tagName) {
    let tag = tagName;
    let releaseType = '';
    if (ref.startsWith('refs/tags') && tagFormat.test(tagName)) {
        if (packageTagFormat.test(tagName)) {
            const regexMatch = tagName.match(packageTagFormat);
            if (regexMatch !== null) {
                tag = regexMatch[2];
            }
        }
        if (releaseFormat.test(tag)) {
            releaseType = 'release';
        }
        else if (prereleaseFormat.test(tag)) {
            releaseType = 'prerelease';
        }
    }
    return {
        releaseType,
        tag,
    };
}
run();
