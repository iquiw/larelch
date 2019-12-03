import * as dotenv from 'dotenv';
import { graphql } from '@octokit/graphql';

async function getReleases(owner: string, project: string) {
  const { repository } = await graphql(`query releases($owner: String!, $project: String!, $num: Int = 5)
{
  repository(owner: $owner, name: $project) {
    releases(first: $num, orderBy: { field: CREATED_AT, direction: DESC }) {
      nodes {
        isPrerelease
        isDraft
        tagName
      }
      pageInfo {
        startCursor
        hasPreviousPage
      }
    }
  }
}`, {
  owner: owner,
  project: project,
  headers: {
    authorization: `token ${process.env.GITHUB_TOKEN}`
  }
});
  return repository.releases;
}

async function getLatestRelease(owner: string, project: string) {
  const releases = await getReleases(owner, project);
  for (let node of releases.nodes) {
    if (!node.isPrerelease && !node.isDraft) {
      return node;
    }
  }
  return null;
}

async function main() {
  for (let i = 2; i < process.argv.length; i++) {
    const repo = process.argv[i];
    const [owner, project] = repo.split('/');
    const release = await getLatestRelease(owner, project);
    if (release) {
      console.log(`${repo}: ${release.tagName}`);
    } else {
      console.log(`${repo}: No release found!`);
    }
  }
}

dotenv.config();
main();
