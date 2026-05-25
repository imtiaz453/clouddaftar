import { execFile } from "child_process";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export type ZatcaSdkValidationResult = {
  skipped: boolean;
  ok: boolean;
  command?: string;
  stdout?: string;
  stderr?: string;
  error?: string;
};

function getSdkCommand(): string | null {
  return process.env.ZATCA_SDK_CLI_PATH || process.env.ZATCA_SDK_COMMAND || null;
}

function getSdkHome(command: string): string | undefined {
  return process.env.FATOORA_HOME || process.env.ZATCA_SDK_HOME || path.dirname(command);
}

function getSdkArgs(xmlPath: string): string[] {
  const template = process.env.ZATCA_SDK_VALIDATE_XML_ARGS;
  if (template) {
    return template.split(" ").map((part) => part.replace("{xml}", xmlPath));
  }

  return ["-validate", "-f", xmlPath];
}

export async function validateXmlWithZatcaSdk(
  xmlPath: string,
): Promise<ZatcaSdkValidationResult> {
  const command = getSdkCommand();
  if (!command) {
    return {
      skipped: true,
      ok: false,
      error: "ZATCA SDK command is not configured",
    };
  }

  try {
    const args = getSdkArgs(xmlPath);
    const sdkHome = getSdkHome(command);
    const { stdout, stderr } = await execFileAsync(command, args, {
      timeout: 60_000,
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 5,
      env: {
        ...process.env,
        FATOORA_HOME: sdkHome,
        PATH: sdkHome ? `${sdkHome}${path.delimiter}${process.env.PATH || ""}` : process.env.PATH,
      },
    });

    return {
      skipped: false,
      ok: true,
      command: `${command} ${args.join(" ")}`,
      stdout,
      stderr,
    };
  } catch (error: any) {
    return {
      skipped: false,
      ok: false,
      command,
      stdout: error?.stdout,
      stderr: error?.stderr,
      error: error instanceof Error ? error.message : "ZATCA SDK validation failed",
    };
  }
}
