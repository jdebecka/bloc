import * as _ from "lodash";
import * as semver from "semver";
import { window, env, Uri } from "vscode";
import { getLatestPackageVersion, getPubspec } from ".";
import { updatePubspecDependency } from "./update-pubspec-dependency";

interface Dependency {
  name: string;
  version: string;
  actions: Action[];
}

interface Action {
  name: string;
  callback: Function;
}

const openBlocMigrationGuide = {
  name: "Open Migration Guide",
  callback: () => {
    env.openExternal(Uri.parse("https://bloclibrary.dev/#/migration"));
  },
};
const openEquatableMigrationGuide = {
  name: "Open Migration Guide",
  callback: () => {
    env.openExternal(
      Uri.parse(
        "https://github.com/felangel/equatable/blob/master/doc/migration_guides/migration-0.6.0.md"
      )
    );
  },
};

const deps = [
  { name: "angular_bloc", actions: [openBlocMigrationGuide] },
  { name: "bloc", actions: [openBlocMigrationGuide] },
  { name: "bloc_concurrency", actions: [openBlocMigrationGuide] },
  { name: "equatable", actions: [openEquatableMigrationGuide] },
  { name: "flutter_bloc", actions: [openBlocMigrationGuide] },
  { name: "hydrated_bloc", actions: [openBlocMigrationGuide] },
  { name: "replay_bloc", actions: [openBlocMigrationGuide] },
  { name: "sealed_flutter_bloc", actions: [openBlocMigrationGuide] },
];

const devDeps = [{ name: "bloc_test", actions: [openBlocMigrationGuide] }];

export async function analyzeDependencies() {
  const dependencies = await getDependencies(deps);
  const devDependencies = await getDependencies(devDeps);
  const pubspec = await getPubspec();
  const pubspecDependencies = _.get(pubspec, "dependencies", {});
  const pubspecDevDependencies = _.get(pubspec, "dev_dependencies", {});

  checkForUpgrades(dependencies, pubspecDependencies);
  checkForUpgrades(devDependencies, pubspecDevDependencies);
}

function checkForUpgrades(
  dependencies: Dependency[],
  pubspecDependencies: object[]
) {
  for (let i = 0; i < dependencies.length; i++) {
    const dependency = dependencies[i];
    if (_.isEmpty(dependency.version)) continue;
    if (_.has(pubspecDependencies, dependency.name)) {
      const dependencyVersion = _.get(
        pubspecDependencies,
        dependency.name,
        "latest"
      );
      if (dependencyVersion === "latest") continue;
      if (dependencyVersion === "any") continue;
      if (dependencyVersion == null) continue;
      if (typeof dependencyVersion !== "string") continue;
      const minVersion = _.get(
        semver.minVersion(dependencyVersion),
        "version",
        "0.0.0"
      );
      if (!semver.satisfies(minVersion, dependency.version)) {
        window
          .showWarningMessage(
            `This workspace contains an outdated version of ${dependency.name}. Please update to ${dependency.version}.`,
            ...dependency.actions.map((action) => action.name).concat("Update")
          )
          .then((invokedAction) => {
            if (invokedAction === "Update") {
              return updatePubspecDependency({
                name: dependency.name,
                latestVersion: `^${dependency.version}`,
                currentVersion: dependencyVersion,
              });
            }
            const action = dependency.actions.find(
              (action) => action.name === invokedAction
            );
            if (!_.isNil(action)) {
              action.callback();
            }
          });
      }
    }
  }
}

async function getDependencies(
  dependencies: { name: string; actions: Action[] }[]
): Promise<Dependency[]> {
  const futures: Promise<Dependency>[] = dependencies.map(
    async (dependency) => {
      return {
        name: dependency.name,
        actions: dependency.actions,
        version: await getLatestPackageVersion(dependency.name),
      };
    }
  );

  return Promise.all(futures);
}
