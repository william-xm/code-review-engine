import { EXCLUDE_FILE_TYPES, MIN_CODE_REVIEW_LINES } from '../constants/config';

// 类型定义 (Type definitions)
interface GitLabDiffItem {
  new_path: string;
  old_path: string;
  diff: string;
  new_file: boolean;
  renamed_file: boolean;
  deleted_file: boolean;
}

interface FilterResult {
  content: string[];
  totalLines: number;
  processedFiles: number;
}

// 纯函数：检查文件是否应该被包含 (Pure function: check if file should be included)
const shouldIncludeFile = (filePath: string): boolean => {
  if (!filePath) return false;

  const extension = filePath.split('.').pop()?.toLowerCase();
  return extension ? EXCLUDE_FILE_TYPES.includes(extension) : false;
};

// 纯函数：过滤和处理差异行 (Pure function: filter and process diff lines)
const processDiffLines = (diffContent: string): string => {
  if (!diffContent) return '';

  const lines = diffContent.split('\n');

  // 过滤掉删除的行和上下文标记行 (Filter out deleted lines and context markers)
  const filteredLines = lines.filter(line => {
    const trimmedLine = line.trim();
    return !trimmedLine.startsWith('-') &&
           !trimmedLine.startsWith('@@') &&
           !trimmedLine.startsWith('+++') &&
           !trimmedLine.startsWith('---');
  });

  return filteredLines.join('\n');
};

// 纯函数：计算有效代码行数 (Pure function: count effective code lines)
const countEffectiveLines = (content: string): number => {
  if (!content) return 0;

  return content
    .split('\n')
    .filter(line => {
      const trimmedLine = line.trim();
      return trimmedLine.length > 0 &&
             !trimmedLine.startsWith('//') &&
             !trimmedLine.startsWith('/*') &&
             !trimmedLine.startsWith('*') &&
             !trimmedLine.startsWith('#');
    })
    .length;
};

// 主要的过滤函数 (Main filter function)
const filterDiffContent = (content: string): string[] | null => {
  try {
    if (!content || content.trim().length === 0) {
      console.warn('Diff content is empty');
      return null;
    }

    let parsedContent: GitLabDiffItem[];

    try {
      parsedContent = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse diff content as JSON:', parseError);
      return null;
    }

    if (!Array.isArray(parsedContent)) {
      console.error('Parsed content is not an array');
      return null;
    }

    // 使用函数式编程方法过滤和处理文件 (Use functional programming approach to filter and process files)
    const processedFiles = parsedContent
      .filter(item => item && item.new_path && shouldIncludeFile(item.new_path))
      .map(item => ({
        ...item,
        processedDiff: processDiffLines(item.diff)
      }))
      .filter(item => item.processedDiff.trim().length > 0);

    console.log('Filtered files for review:', processedFiles.map(f => f.new_path));

    // 计算总的有效代码行数 (Calculate total effective code lines)
    const totalEffectiveLines = processedFiles.reduce((total, item) => {
      return total + countEffectiveLines(item.processedDiff);
    }, 0);

    console.log(`Total effective lines: ${totalEffectiveLines}, Minimum required: ${MIN_CODE_REVIEW_LINES}`);

    // 检查是否达到最小代码审查行数 (Check if minimum code review lines are met)
    if (totalEffectiveLines < MIN_CODE_REVIEW_LINES) {
      console.log('Code changes below minimum review threshold');
      return null;
    }

    // 返回处理后的内容 (Return processed content)
    const result = processedFiles.map(item => item.processedDiff);

    console.log(`Successfully processed ${processedFiles.length} files with ${totalEffectiveLines} lines`);

    return result;
  } catch (error) {
    console.error('Error filtering diff content:', error);
    return null;
  }
};

// 辅助函数：获取文件统计信息 (Helper function: get file statistics)
const getFileStats = (content: string): FilterResult | null => {
  const filtered = filterDiffContent(content);

  if (!filtered) return null;

  return {
    content: filtered,
    totalLines: filtered.reduce((total, item) => total + countEffectiveLines(item), 0),
    processedFiles: filtered.length
  };
};

// 辅助函数：验证差异内容格式 (Helper function: validate diff content format)
const validateDiffFormat = (content: string): boolean => {
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) && parsed.every(item =>
      typeof item === 'object' &&
      'new_path' in item &&
      'diff' in item
    );
  } catch {
    return false;
  }
};

export {
  filterDiffContent,
  getFileStats,
  validateDiffFormat,
  shouldIncludeFile,
  processDiffLines,
  countEffectiveLines
};