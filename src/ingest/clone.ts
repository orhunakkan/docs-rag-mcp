import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { simpleGit } from 'simple-git';

export interface ClonedRepo {
  repoPath: string;
  commitSha: string;
}

/** @param ref Optional branch or tag to pin the shallow clone to (defaults to the repo's default branch). */
export async function cloneDocsRepo(repoUrl: string, ref?: string): Promise<ClonedRepo> {
  const repoPath = await mkdtemp(join(tmpdir(), 'docs-rag-mcp-sync-'));
  const git = simpleGit();
  const args = ref ? ['--depth', '1', '--branch', ref] : ['--depth', '1'];
  await git.clone(repoUrl, repoPath, args);
  const commitSha = (await simpleGit(repoPath).revparse(['HEAD'])).trim();
  return { repoPath, commitSha };
}

export async function cleanupClone(repoPath: string): Promise<void> {
  await rm(repoPath, { recursive: true, force: true });
}
