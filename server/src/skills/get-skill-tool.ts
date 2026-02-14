/**
 * GetSkillTool - Tool for Agent to load Skills on-demand
 */

import type { Tool, ToolInput, ToolResult } from '../tools/base.js';
import type { SkillLoader } from './skill-loader.js';

export class GetSkillTool implements Tool {
  name = 'get_skill';
  description =
    'Get complete content and guidance for a specified skill, used for executing specific types of tasks';
  parameters = {
    type: 'object',
    properties: {
      skill_name: {
        type: 'string',
        description: 'Name of skill to retrieve',
      },
    },
    required: ['skill_name'],
  };

  constructor(private skillLoader: SkillLoader) {}

  async execute(params: ToolInput): Promise<ToolResult> {
    const skillName = params['skill_name'] as string;

    if (!skillName) {
      return {
        success: false,
        content: '',
        error: 'Missing required parameter: skill_name',
      };
    }

    const skill = this.skillLoader.getSkill(skillName);

    if (!skill) {
      const available = this.skillLoader.listSkills().join(', ');
      return {
        success: false,
        content: '',
        error: `Skill '${skillName}' does not exist. Available skills: ${available}`,
      };
    }

    const content = this.formatSkillAsPrompt(skill);

    return {
      success: true,
      content,
    };
  }

  private formatSkillAsPrompt(skill: {
    name: string;
    description: string;
    content: string;
  }): string {
    return `# Skill: ${skill.name}

${skill.description}

---

${skill.content}`;
  }
}
