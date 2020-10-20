import {
  apply,
  applyTemplates,
  chain,
  mergeWith,
  move,
  Rule,
  url,
} from '@angular-devkit/schematics';
import {
  addProjectToNxJsonInTree,
  names,
  offsetFromRoot,
  projectRootDir,
  ProjectType,
  toFileName,
  updateWorkspace,
} from '@nrwl/workspace';
import { NxAwsCacheSchematicSchema } from './schema';

/**
 * Depending on your needs, you can change this to either `Library` or `Application`
 */
const projectType = ProjectType.Library;

interface NormalizedSchema extends NxAwsCacheSchematicSchema {
  projectName: string;
  projectRoot: string;
  projectDirectory: string;
  parsedTags: string[];
}

function normalizeOptions(options: NxAwsCacheSchematicSchema): NormalizedSchema {
  const name = toFileName(options.name),
    projectDirectory = options.directory ? `${toFileName(options.directory)}/${name}` : name,
    projectName = projectDirectory.replace(/\//gu, '-'),
    projectRoot = `${projectRootDir(projectType)}/${projectDirectory}`,
    parsedTags = options.tags ? options.tags.split(',').map((tag) => tag.trim()) : [];

  return {
    ...options,
    projectName,
    projectRoot,
    projectDirectory,
    parsedTags,
  };
}

function addFiles(options: NormalizedSchema): Rule {
  return mergeWith(
    apply(url(`./files`), [
      applyTemplates({
        ...options,
        ...names(options.name),
        offsetFromRoot: offsetFromRoot(options.projectRoot),
      }),
      move(options.projectRoot),
    ]),
  );
}

function main(options: NxAwsCacheSchematicSchema): Rule {
  const normalizedOptions = normalizeOptions(options);
  return chain([
    updateWorkspace((workspace) => {
      workspace.projects
        .add({
          name: normalizedOptions.projectName,
          root: normalizedOptions.projectRoot,
          sourceRoot: `${normalizedOptions.projectRoot}/src`,
          projectType,
        })
        .targets.add({
          name: 'build',
          builder: '@nx-aws/nx-aws-cache:build',
        });
    }),
    addProjectToNxJsonInTree(normalizedOptions.projectName, {
      tags: normalizedOptions.parsedTags,
    }),
    addFiles(normalizedOptions),
  ]);
}

export default main;
