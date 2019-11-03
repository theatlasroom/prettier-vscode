import {
  ConfigurationTarget,
  Uri,
  window,
  workspace,
  WorkspaceConfiguration
  // tslint:disable-next-line: no-implicit-dependencies
} from "vscode";
import * as nls from "vscode-nls";
import { createConfigFileFunction } from "./Commands";
import {
  LEGACY_VSCODE_LINTER_CONFIG_MESSAGE,
  LEGACY_VSCODE_PRETTIER_CONFIG_MESSAGE,
  MIGRATE_CONFIG_ACTION_TEXT,
  OUTDATED_PRETTIER_VERSION_MESSAGE
} from "./Consts";
import { PrettierModule } from "./types";

const localize = nls.config()();

export class NotificationService {
  public noLegacyConfigWorkspaces: string[] = [];

  constructor(private createConfigFileCommand: createConfigFileFunction) {}
  public warnOutdatedPrettierVersion(
    prettierInstance?: PrettierModule,
    prettierPath?: string
  ) {
    const message = localize(
      "ext.config.outdatedPrettiereVersion",
      OUTDATED_PRETTIER_VERSION_MESSAGE
    ).replace("{{path}}", prettierPath || "unknown");
    window.showErrorMessage(message);
  }

  public async warnIfLegacyConfiguration(uri: Uri) {
    const workspaceFolder = workspace.getWorkspaceFolder(uri);
    const cacheKey = workspaceFolder ? workspaceFolder.uri.fsPath : uri.fsPath;
    if (this.noLegacyConfigWorkspaces.indexOf(cacheKey) > -1) {
      return;
    }
    const vscodeConfig = workspace.getConfiguration("prettier", uri);
    const hasLegacyConfig =
      (await this.warnIfLegacyPrettierConfiguration(vscodeConfig)) ||
      (await this.warnIfLegacyLinterConfiguration(vscodeConfig));
    if (!hasLegacyConfig) {
      // No legacy configs, add to cache
      this.noLegacyConfigWorkspaces.push(cacheKey);
    }
  }

  public async showErrorMessage(
    label: string,
    message: string,
    extraLines?: string[]
  ) {
    const localizedMessage = localize(label, message);

    if (extraLines) {
      const lines = [localizedMessage];
      lines.push(...extraLines);
      return window.showErrorMessage(lines.join(" "));
    } else {
      return window.showErrorMessage(localizedMessage);
    }
  }

  public clearCache() {
    this.noLegacyConfigWorkspaces = [];
  }

  /**
   * Check if the resource has legacy config. Returns true if legacy config is found.
   * @param vscodeConfig The configuration
   */
  private async warnIfLegacyLinterConfiguration(
    vscodeConfig: WorkspaceConfiguration
  ): Promise<boolean> {
    const hasLegacyConfig =
      vscodeConfig.get("eslintIntegration") !== null ||
      vscodeConfig.get("tslintIntegration") !== null ||
      vscodeConfig.get("stylelintIntegration") !== null;
    if (hasLegacyConfig) {
      const message = localize(
        "ext.config.legacyLinterConfigInUse",
        LEGACY_VSCODE_LINTER_CONFIG_MESSAGE
      );

      await window.showErrorMessage(message);
    }
    return hasLegacyConfig;
  }

  /**
   * Check if the resource has legacy config. Returns true if legacy config is found.
   * @param vscodeConfig The configuration
   */
  private async warnIfLegacyPrettierConfiguration(
    vscodeConfig: WorkspaceConfiguration
  ): Promise<boolean> {
    const legacyConfigOptions = [
      "printWidth",
      "tabWidth",
      "singleQuote",
      "trailingComma",
      "bracketSpacing",
      "jsxBracketSameLine",
      "semi",
      "useTabs",
      "proseWrap",
      "arrowParens",
      "jsxSingleQuote",
      "htmlWhitespaceSensitivity",
      "endOfLine",
      "quoteProps"
    ];

    const migratedOptions = new Map<string, any>();
    legacyConfigOptions.forEach(key => {
      const val = vscodeConfig.get(key);
      if (val !== null) {
        migratedOptions.set(key, val);
      }
    });
    const hasLegacyConfig = migratedOptions.size > 0;
    if (hasLegacyConfig) {
      const message = localize(
        "ext.config.legacyPrettierConfigInUse",
        LEGACY_VSCODE_PRETTIER_CONFIG_MESSAGE
      );

      const result = await window.showErrorMessage(
        message,
        MIGRATE_CONFIG_ACTION_TEXT
      );
      if (result && result === MIGRATE_CONFIG_ACTION_TEXT) {
        await this.createConfigFileCommand(migratedOptions);
        legacyConfigOptions.forEach(key => {
          const inspected = vscodeConfig.inspect(key);
          if (inspected && inspected.workspaceFolderValue) {
            vscodeConfig.update(
              key,
              undefined,
              ConfigurationTarget.WorkspaceFolder
            );
          }
        });
      }
    }
    return hasLegacyConfig;
  }
}