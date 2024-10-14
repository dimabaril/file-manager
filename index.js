import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import zlib from "node:zlib";
import readline from "node:readline";
import { pipeline } from "node:stream";
import { promisify } from "node:util";

const pipelineAsync = promisify(pipeline);

const args = process.argv.slice(2);
const usernameArg = args.find((arg) => arg.startsWith("--username="));
const username = usernameArg ? usernameArg.split("=")[1] : "User";

const homeDir = os.homedir();
let currentDir = homeDir;

console.log(`Welcome to the File Manager, ${username}!`);
console.log(`You are currently in ${currentDir}`);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: ">",
});

rl.prompt();

rl.on("line", async (input) => {
  const [command, ...commandArgs] = input.trim().split(" ");

  try {
    switch (command) {
      case "up":
        handleUp();
        break;
      case "cd":
        await handleCd(commandArgs);
        break;
      case "ls":
        await handleLs();
        break;
      case "cat":
        await handleCat(commandArgs);
        break;
      case "add":
        await handleAdd(commandArgs);
        break;
      case "rn":
        await handleRename(commandArgs);
        break;
      case "cp":
        await handleCopy(commandArgs);
        break;
      case "mv":
        await handleMove(commandArgs);
        break;
      case "rm":
        await handleRemove(commandArgs);
        break;
      case "os":
        await handleOs(commandArgs);
        break;
      case "hash":
        await handleHash(commandArgs);
        break;
      case "compress":
        await handleCompress(commandArgs);
        break;
      case "decompress":
        await handleDecompress(commandArgs);
        break;
      case ".exit":
        exitProgram();
        break;
      default:
        console.log("Invalid input");
    }
  } catch (error) {
    console.log("Operation failed");
  }

  console.log(`You are currently in ${currentDir}`);
  rl.prompt();
}).on("close", () => {
  exitProgram();
});

const handleUp = () => {
  const parentDir = path.dirname(currentDir);
  const rootDir = path.parse(currentDir).root;
  if (parentDir === currentDir) {
    return;
  }
  currentDir = parentDir;
};

const handleCd = async (args) => {
  if (args.length === 0) {
    throw new Error("Path not specified");
  }
  const targetPath = path.isAbsolute(args[0])
    ? args[0]
    : path.join(currentDir, args[0]);
  const stats = await fs.promises.stat(targetPath);
  if (stats.isDirectory()) {
    currentDir = path.resolve(targetPath);
  } else {
    throw new Error("Not a directory");
  }
};

const handleLs = async () => {
  try {
    const files = await fs.promises.readdir(currentDir, {
      withFileTypes: true,
    });

    const directories = files
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => ({ name: dirent.name, type: "Directory" }));

    const regularFiles = files
      .filter((dirent) => dirent.isFile())
      .map((dirent) => ({ name: dirent.name, type: "File" }));

    const sortedDirs = directories.sort((a, b) => a.name.localeCompare(b.name));
    const sortedFiles = regularFiles.sort((a, b) =>
      a.name.localeCompare(b.name),
    );

    console.table([...sortedDirs, ...sortedFiles]);
  } catch (error) {
    console.log("Operation failed");
  }
};

const handleCat = async (args) => {
  if (args.length === 0) {
    throw new Error("File path not specified");
  }
  const filePath = path.isAbsolute(args[0])
    ? args[0]
    : path.join(currentDir, args[0]);

  const readable = fs.createReadStream(filePath, "utf-8");

  readable.on("error", () => {
    throw new Error("Cannot read file");
  });

  readable.pipe(process.stdout);
  await new Promise((resolve, reject) => {
    readable.on("end", resolve);
    readable.on("error", reject);
  });
};

const handleAdd = async (args) => {
  if (args.length === 0) {
    throw new Error("File name not specified");
  }
  const filePath = path.join(currentDir, args[0]);
  await fs.promises.writeFile(filePath, "");
};

const handleRename = async (args) => {
  if (args.length < 2) {
    throw new Error("Insufficient arguments");
  }
  const oldPath = path.isAbsolute(args[0])
    ? args[0]
    : path.join(currentDir, args[0]);
  const newPath = path.join(currentDir, args[1]);
  await fs.promises.rename(oldPath, newPath);
};

const handleCopy = async (args) => {
  if (args.length < 2) {
    throw new Error("Insufficient arguments");
  }
  const srcPath = path.isAbsolute(args[0])
    ? args[0]
    : path.join(currentDir, args[0]);
  const destDir = path.isAbsolute(args[1])
    ? args[1]
    : path.join(currentDir, args[1]);

  const fileName = path.basename(srcPath);
  const destPath = path.join(destDir, fileName);

  await fs.promises.access(destDir);
  await fs.promises.access(srcPath);

  const readable = fs.createReadStream(srcPath);
  const writable = fs.createWriteStream(destPath);

  await pipelineAsync(readable, writable);
};

const handleMove = async (args) => {
  if (args.length < 2) {
    throw new Error("Insufficient arguments");
  }
  const srcPath = path.isAbsolute(args[0])
    ? args[0]
    : path.join(currentDir, args[0]);
  const destDir = path.isAbsolute(args[1])
    ? args[1]
    : path.join(currentDir, args[1]);

  const fileName = path.basename(srcPath);
  const destPath = path.join(destDir, fileName);

  await fs.promises.access(destDir);
  await fs.promises.access(srcPath);

  const readable = fs.createReadStream(srcPath);
  const writable = fs.createWriteStream(destPath);

  await pipelineAsync(readable, writable);

  await fs.promises.unlink(srcPath);
};

const handleRemove = async (args) => {
  if (args.length === 0) {
    throw new Error("File path not specified");
  }
  const filePath = path.isAbsolute(args[0])
    ? args[0]
    : path.join(currentDir, args[0]);
  await fs.promises.unlink(filePath);
};

const handleOs = async (args) => {
  if (args.length === 0) {
    throw new Error("No sub-command specified");
  }
  switch (args[0]) {
    case "--EOL":
      console.log(JSON.stringify(os.EOL));
      break;
    case "--cpus":
      const cpus = os.cpus();
      console.log(`Overall CPUs: ${cpus.length}`);
      cpus.forEach((cpu, index) => {
        console.log(
          `CPU ${index + 1}: ${cpu.model}, ${(cpu.speed / 1000).toFixed(
            2,
          )} GHz`,
        );
      });
      break;
    case "--homedir":
      console.log(os.homedir());
      break;
    case "--username":
      console.log(os.userInfo().username);
      break;
    case "--architecture":
      console.log(process.arch);
      break;
    default:
      console.log("Invalid OS command");
  }
};

const handleHash = async (args) => {
  if (args.length === 0) {
    throw new Error("File path not specified");
  }
  const filePath = path.isAbsolute(args[0])
    ? args[0]
    : path.join(currentDir, args[0]);

  const hash = crypto.createHash("sha256");
  const readable = fs.createReadStream(filePath);

  readable.on("error", () => {
    throw new Error("Cannot read file");
  });

  readable.on("data", (chunk) => {
    hash.update(chunk);
  });

  await new Promise((resolve, reject) => {
    readable.on("end", () => {
      console.log(hash.digest("hex"));
      resolve();
    });
    readable.on("error", reject);
  });
};

const handleCompress = async (args) => {
  if (args.length < 2) {
    throw new Error("Insufficient arguments");
  }
  const srcPath = path.isAbsolute(args[0])
    ? args[0]
    : path.join(currentDir, args[0]);
  const destPath = path.isAbsolute(args[1])
    ? args[1]
    : path.join(currentDir, args[1]);

  const readable = fs.createReadStream(srcPath);
  const writable = fs.createWriteStream(destPath);
  const brotli = zlib.createBrotliCompress();

  await pipelineAsync(readable, brotli, writable);
};

const handleDecompress = async (args) => {
  if (args.length < 2) {
    throw new Error("Insufficient arguments");
  }
  const srcPath = path.isAbsolute(args[0])
    ? args[0]
    : path.join(currentDir, args[0]);
  const destPath = path.isAbsolute(args[1])
    ? args[1]
    : path.join(currentDir, args[1]);

  const readable = fs.createReadStream(srcPath);
  const writable = fs.createWriteStream(destPath);
  const brotli = zlib.createBrotliDecompress();

  await pipelineAsync(readable, brotli, writable);
};

const exitProgram = () => {
  console.log(`Thank you for using File Manager, ${username}, goodbye!`);
  process.exit(0);
};

process.on("SIGINT", () => {
  exitProgram();
});
