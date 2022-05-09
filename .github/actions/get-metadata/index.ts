import { context } from '@actions/github';
import { notice, setFailed, setOutput } from '@actions/core';

// eslint-disable-next-line unicorn/better-regex
const packageTagFormat = new RegExp(/^(.+)-(v(([0-9]{1,}\.){2})[0-9]{1,}(-alpha\.[0-9]{1,})?)$/);
// eslint-disable-next-line unicorn/better-regex
const tagFormat = new RegExp(/^v([0-9]{1,}\.){2}[0-9]{1,}(-alpha\.[0-9]{1,})?/);
// eslint-disable-next-line unicorn/better-regex
const releaseFormat = new RegExp(/^v([0-9]{1,}\.){2}[0-9]{1,}$/);
// eslint-disable-next-line unicorn/better-regex
const prereleaseFormat = new RegExp(/^v([0-9]{1,}\.){2}[0-9]{1,}(-alpha\.[0-9]{1,})$/);

// eslint-disable-next-line max-lines-per-function,complexity
function run(): void {
  try {
    if (context.payload.repository === undefined) {
      throw new Error('repository missing in the payload');
    }

    const repoName = context.payload.repository.name;
    const ref = context.ref;
    notice(`The repo: ${repoName}`);

    const shortRef = ref.substring(ref.lastIndexOf('/') + 1);

    notice(`Ref: ${ref}, short ref: ${shortRef}`);
    const tagName = ref.startsWith('refs/tags') ? shortRef : context.sha;
    const releaseVersion = tagName.startsWith('v') ? tagName.substring(1) : null;
    const { releaseType, tag } = getReleaseTypeAndConfig(ref, tagName);

    notice(`Tag name: ${tag}`);
    notice(`Release type: ${releaseType} - ${ref}`);

    setOutput('tag-name', tagName);
    setOutput('release-version', releaseVersion);
    setOutput('release-type', releaseType);
  } catch (error) {
    setFailed((<Error>error).message);
  }
}

interface ReleaseTypeAndConfig {
  releaseType: string;
  tag: string;
}

function getReleaseTypeAndConfig(ref: string, tagName: string): ReleaseTypeAndConfig {
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
    } else if (prereleaseFormat.test(tag)) {
      releaseType = 'prerelease';
    }
  }

  return {
    releaseType,
    tag,
  };
}

run();
