import * as walk from "klaw";
import * as Path from "path";
import * as i from "./../Interfaces";
import * as e from "./../Enums";
import * as _ from "lodash";
import * as fs from "fs-extra";
import {KeyCode} from "./../Enums";
import {EnvironmentPath} from "../shell/Environment";

interface FSExtraWalkObject {
    path: string;
    stats: fs.Stats;
}

export function info(...args: any[]): void {
    print(e.LogLevel.Info, args);
}

export function log(...args: any[]): void {
    print(e.LogLevel.Log, args);
}

export function error(...args: any[]): void {
    print(e.LogLevel.Error, args);
}

export function print(level: e.LogLevel, args: Array<any>): void {
    if ((typeof window !== "undefined") && window.DEBUG) {
        (<Function>(<any>console)[level])(...args);
    }
}

export function times(n: number, action: Function): void {
    for (let i = 0; i !== n; ++i) {
        action();
    }
}

export const io = {
    filesIn: async (directoryPath: FullPath): Promise<string[]> => {
        if (await io.directoryExists(directoryPath)) {
            return await fs.readdir(directoryPath);
        } else {
            return [];
        }
    },
    recursiveFilesIn: (directoryPath: string): Promise<string[]> => {
        let files: string[] = [];

        return new Promise(resolve =>
            walk(directoryPath)
                .on("data", (file: FSExtraWalkObject) => file.stats.isFile() && files.push(file.path))
                .on("end", () => resolve(files)),
        );
    },
    lstatsIn: async (directoryPath: FullPath): Promise<i.FileInfo[]> => {
        return Promise.all((await io.filesIn(directoryPath)).map(async (fileName) => {
            return {name: fileName, stat: await fs.lstat(Path.join(directoryPath, fileName))};
        }));
    },
    fileExists: async (filePath: string): Promise<boolean> => {
        if (!await fs.pathExists(filePath)) {
            return false;
        }

        const stat = await fs.lstat(filePath);

        if (stat.isFile()) {
            return true;
        }

        if (stat.isSymbolicLink()) {
            const realPath = await io.realPath(filePath);
            return io.fileExists(realPath);
        }

        return false;
    },
    directoryExists: async (directoryPath: string): Promise<boolean> => {
        if (await fs.pathExists(directoryPath)) {
            return (await fs.lstat(directoryPath)).isDirectory();
        } else {
            return false;
        }
    },
    readFile: async (filePath: string) => (await fs.readFile(filePath)).toString(),
    executablesInPaths: async (path: EnvironmentPath): Promise<string[]> => {
        const allFiles: string[][] = await Promise.all(path.toArray().map(io.filesIn));
        return _.uniq(_.flatten(allFiles));
    },
    realPath: fs.realpath,
};

/**
 * Unlike Path.join, doesn't remove ./ and ../ parts.
 */
export function joinPath(...parts: string[]) {
    const initialParts = parts.slice(0, -1).filter(part => part.length);
    const lastPart = parts[parts.length - 1];

    return initialParts.map(normalizeDirectory).join("") + lastPart;
}

export function normalizeDirectory(directoryPath: string): string {
    if (directoryPath.endsWith(Path.sep)) {
        return directoryPath;
    } else {
        return directoryPath + Path.sep;
    }
}

export function directoryName(path: string): string {
    const directoryParts = path.split(Path.sep).slice(0, -1);

    if (directoryParts.length === 0) {
        return "";
    } else {
        return normalizeDirectory(directoryParts.join(Path.sep));
    }
}

export const isWindows = process.platform === "win32";
export const homeDirectory = process.env[(isWindows) ? "USERPROFILE" : "HOME"]!;

export function resolveDirectory(pwd: string, directory: string): FullPath {
    return <FullPath>normalizeDirectory(resolveFile(pwd, directory));
}

export function resolveFile(pwd: string, file: string): FullPath {
    return <FullPath>Path.resolve(pwd, file.replace(/^~/, homeDirectory));
}

export function userFriendlyPath(path: string): string {
    return path.replace(homeDirectory, "~");
}

export async function filterAsync<T>(values: T[], asyncPredicate: (t: T) => Promise<boolean>): Promise<T[]> {
    const filtered = await Promise.all(values.map(asyncPredicate));
    return values.filter((_value: T, index: number) => filtered[index]);
}

export async function reduceAsync<A, E>(array: E[], initial: A, callback: (a: A, e: E) => Promise<A>): Promise<A> {
    let accumulator = initial;

    for (const element of array) {
        accumulator = await callback(accumulator, element);
    }

    return accumulator;
}

export function pluralize(word: string, count = 2) {
    return count === 1 ? word : pluralFormOf(word);
}

const imageExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
];

export function isImage(extension: string) {
    return imageExtensions.includes(extension);
}

function pluralFormOf(word: string) {
    if (word.endsWith("y")) {
        return word.substring(0, word.length - 1) + "ies";
    } else {
        return word + "s";
    }
}

export function groupWhen<T>(grouper: (a: T, b: T) => boolean, row: T[]): T[][] {
    if (row.length === 0) return [];
    if (row.length === 1) return [row];

    const result: T[][] = [];
    const firstValue = row[0];
    let currentGroup: T[] = [firstValue];
    let previousValue: T = firstValue;

    row.slice(1).forEach(currentValue => {
        if (grouper(currentValue, previousValue)) {
            currentGroup.push(currentValue);
        } else {
            result.push(currentGroup);
            currentGroup = [currentValue];
        }

        previousValue = currentValue;
    });
    result.push(currentGroup);

    return result;
}

export function csi(char: string) {
    return `\x1b[${char}`;
}

export function ss3(char: string) {
    return `\x1bO${char}`;
}

export function normalizeProcessInput(input: string | KeyboardEvent, isCursorKeysModeSet: boolean): string {
    let text: string;

    if (typeof input === "string") {
        text = input;
    } else {
        if (input.ctrlKey) {
            /**
             * @link https://unix.stackexchange.com/a/158298/201739
             */
            text = String.fromCharCode(input.key.toUpperCase().charCodeAt(0) - 64);
        } else if (input.altKey) {
            /**
             * The alt key can mean two things:
             *   - send an escape character before special keys such as cursor-keys, or
             *   - act as an extended shift, allowing you to enter codes for Latin-1 values from 160 to 255.
             *
             * We currently don't support the second one since it's less frequently used.
             * For future reference, the correct extended code would be keyCode + 160.
             * @link http://invisible-island.net/ncurses/ncurses.faq.html#bash_meta_mode
             */
            let char = String.fromCharCode(input.keyCode);
            if (input.shiftKey) {
                char = char.toUpperCase();
            } else {
                char = char.toLowerCase();
            }
            text = `\x1b${char}`;
        } else {
            text = normalizeKey(input.key, isCursorKeysModeSet);
        }
    }

    return text;
}

/**
 * @link https://www.w3.org/TR/uievents/#widl-KeyboardEvent-key
 */
function normalizeKey(key: string, isCursorKeysModeSet: boolean): string {
    switch (key) {
        case "Backspace":
            return String.fromCharCode(127);
        case "Delete":
            /**
             * @link http://www.macfreek.nl/memory/Backspace_and_Delete_key_reversed
             */
            return csi("3~");
        case "Tab":
            return String.fromCharCode(KeyCode.Tab);
        case "Enter":
            return String.fromCharCode(KeyCode.CarriageReturn);
        case "Escape":
            return String.fromCharCode(KeyCode.Escape);
        case "ArrowLeft":
            return isCursorKeysModeSet ? ss3("D") : csi("D");
        case "ArrowUp":
            return isCursorKeysModeSet ? ss3("A") : csi("A");
        case "ArrowRight":
            return isCursorKeysModeSet ? ss3("C") : csi("C");
        case "ArrowDown":
            return isCursorKeysModeSet ? ss3("B") : csi("B");
        case "F1":
            return ss3("P");
        case "F2":
            return ss3("Q");
        case "F3":
            return ss3("R");
        case "F4":
            return ss3("S");
        case "F5":
            return csi("15~");
        case "F6":
            return csi("17~");
        case "F7":
            return csi("18~");
        case "F8":
            return csi("19~");
        case "F9":
            return csi("20~");
        case "F10":
            return csi("21~");
        case "F11":
            return csi("23~");
        case "F12":
            return csi("24~");
        default:
            return key;
    }
}

export function commonPrefix(left: string, right: string) {
    let i = 0;

    while (i < left.length && left.charAt(i) === right.charAt(i)) {
        ++i;
    }
    return left.substring(0, i);
}

export function mapObject<T, R>(object: Dictionary<T>, mapper: (key: string, value: T) => R): R[] {
    const result: R[] = [];

    for (const key of Object.keys(object)) {
        result.push(mapper(key, object[key]));
    }

    return result;
}

export function escapeFilePath(unescaped: string): string {
    return unescaped.replace(/([\s'"\[\]<>#$%^&*()])/g, "\\$1");
}

const baseConfigDirectory = Path.join(homeDirectory, ".upterm");
export const presentWorkingDirectoryFilePath = Path.join(baseConfigDirectory, "presentWorkingDirectory");
export const historyFilePath = Path.join(baseConfigDirectory, "history.csv");
export const windowBoundsFilePath = Path.join(baseConfigDirectory, "windowBounds");

export function fuzzyMatch(input: string, candidate: string): boolean {
    function tokenize(string: string) {
        return string.split(/-|_|:|\//);
    }

    const lowerCasedInput = input.toLowerCase();

    // A user wants to match by an exact prefix.
    if (candidate.toLowerCase().startsWith(lowerCasedInput)) {
        return true;
    }

    // A user wants to match by a part of the word, e.g. chr for google-chrome.
    if (tokenize(candidate).find(token => token.toLowerCase().startsWith(lowerCasedInput))) {
        return true;
    }

    return false;
}
