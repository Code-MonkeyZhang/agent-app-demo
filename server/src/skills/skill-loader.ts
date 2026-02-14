/**
 * Skill Loader - Load Claude Skills
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import yaml from 'yaml';
import { SkillSchema } from './types.js';
import type { Skill } from './types.js';

export class SkillLoader {
  private skillsDir: string;
  private loadedSkills: Map<string, Skill>;

  constructor(skillsDir: string = './skills') {
    this.skillsDir = skillsDir;
    this.loadedSkills = new Map();
  }

  private extractFrontmatter(
    content: string
  ): { frontmatterText: string; body: string } | null {
    const firstDivider = content.indexOf('---\n');
    if (firstDivider === -1) return null;

    const secondDivider = content.indexOf('\n---\n', firstDivider + 4);
    if (secondDivider === -1) return null;

    return {
      frontmatterText: content.substring(firstDivider + 4, secondDivider),
      body: content.substring(secondDivider + 5),
    };
  }

  loadSkill(skillPath: string): Skill | null {
    try {
      const content = fs.readFileSync(skillPath, 'utf-8');

      const extracted = this.extractFrontmatter(content);
      if (!extracted) {
        console.warn(`⚠️  ${skillPath} missing valid frontmatter`);
        return null;
      }

      const { frontmatterText, body } = extracted;

      let frontmatter: any;
      try {
        frontmatter = yaml.parse(frontmatterText);
      } catch (error) {
        console.error(`❌ Failed to parse YAML: ${error}`);
        return null;
      }

      const validated = SkillSchema.safeParse(frontmatter);
      if (!validated.success) {
        console.error(`❌ Skill validation failed`);
        return null;
      }

      const skillDir = path.dirname(skillPath);

      const processedContent = this.processSkillPaths(body, skillDir);

      const skill: Skill = {
        ...validated.data,
        content: processedContent,
        skillPath,
      };

      return skill;
    } catch (error) {
      console.error(`❌ Failed to load skill (${skillPath}): ${error}`);
      return null;
    }
  }

  private processSkillPaths(content: string, skillDir: string): string {
    const patternDirs =
      /(python\s+|`)((?:scripts|examples|templates|reference)\/[^\s`\)]+)/g;
    content = content.replace(patternDirs, (match, prefix, relPath) => {
      const absPath = path.resolve(skillDir, relPath);
      if (fs.existsSync(absPath)) {
        return `${prefix}${absPath}`;
      }
      return match;
    });

    const patternDocs =
      /(see|read|refer to|check)\s+([a-zA-Z0-9_-]+\.(?:md|txt|json|yaml))([.,;\s])/gi;
    content = content.replace(
      patternDocs,
      (match, prefix, filename, suffix) => {
        const absPath = path.resolve(skillDir, filename);
        if (fs.existsSync(absPath)) {
          return `${prefix}\`${absPath}\` (use read_file to access)${suffix}`;
        }
        return match;
      }
    );

    const patternMarkdown =
      /(?:(Read|See|Check|Refer to|Load|View)\s+)?\[(`?[^`\]]+`?)\]\(((?:\.)?[^)]+\.(?:md|txt|json|yaml|js|py|html))\)/gi;
    content = content.replace(
      patternMarkdown,
      (match, prefix, linkText, filepath) => {
        const cleanPath = filepath.startsWith('./')
          ? filepath.slice(2)
          : filepath;
        const absPath = path.resolve(skillDir, cleanPath);
        if (fs.existsSync(absPath)) {
          const effectivePrefix = prefix || '';
          return `${effectivePrefix}[${linkText}](\`${absPath}\`) (use read_file to access)`;
        }
        return match;
      }
    );

    return content;
  }

  discoverSkills(): Skill[] {
    const skills: Skill[] = [];

    if (!fs.existsSync(this.skillsDir)) {
      console.warn(`⚠️  Skills directory does not exist: ${this.skillsDir}`);
      return skills;
    }

    const findSkillFiles = (dir: string): string[] => {
      const skillFiles: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          skillFiles.push(...findSkillFiles(fullPath));
        } else if (entry.name === 'SKILL.md') {
          skillFiles.push(fullPath);
        }
      }

      return skillFiles;
    };

    const skillFiles = findSkillFiles(this.skillsDir);

    for (const skillFile of skillFiles) {
      const skill = this.loadSkill(skillFile);
      if (skill) {
        if (this.loadedSkills.has(skill.name)) {
          console.warn(
            `⚠️  Duplicate skill name detected: '${skill.name}'. Using first occurrence.`
          );
          continue;
        }
        skills.push(skill);
        this.loadedSkills.set(skill.name, skill);
      }
    }

    console.log(`✅ Discovered ${skills.length} Claude Skills`);
    return skills;
  }

  getSkill(name: string): Skill | undefined {
    return this.loadedSkills.get(name);
  }

  listSkills(): string[] {
    return Array.from(this.loadedSkills.keys());
  }

  getSkillsMetadataPrompt(): string {
    if (this.loadedSkills.size === 0) {
      return '';
    }

    const promptParts: string[] = [];
    promptParts.push('## Available Skills\n');
    promptParts.push(
      'You have access to specialized skills. Each skill provides expert guidance for specific tasks.\n'
    );
    promptParts.push(
      "Load a skill's full content using get_skill tool when needed.\n"
    );

    for (const skill of this.loadedSkills.values()) {
      promptParts.push(`- \`${skill.name}\`: ${skill.description}`);
    }

    return promptParts.join('\n');
  }
}
