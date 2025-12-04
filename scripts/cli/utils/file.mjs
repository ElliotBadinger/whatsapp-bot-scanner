import fs from "node:fs/promises";
import path from "node:path";

export class FileManager {
  async ensureFileExists(filePath, templatePath = null) {
    try {
      await fs.access(filePath);
    } catch {
      if (templatePath) {
        await this.copyFile(templatePath, filePath);
      } else {
        await fs.writeFile(filePath, "");
      }
    }
  }

  async copyFile(source, destination) {
    await fs.copyFile(source, destination);
  }

  async readFile(filePath) {
    return await fs.readFile(filePath, "utf8");
  }

  async writeFile(filePath, content) {
    await fs.writeFile(filePath, content);
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async createDirectory(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
      return true;
    } catch (error) {
      if (error.code === "EEXIST") {
        return true;
      }
      throw error;
    }
  }
}
