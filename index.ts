import * as dotenv from 'dotenv';
import { graphql } from '@octokit/graphql';

async function getReleases(owner: string, project: string, before: string, num: number = 10) {
  const { repository } = await graphql(`query releases($owner: String!, $project: String!, $num: Int!, $before: String)
{
  repository(owner: $owner, name: $project) {
    releases(last: $num, before: $before) {
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
  owner,
  project,
  num,
  before,
  headers: {
    authorization: `token ${process.env.GITHUB_TOKEN}`
  }
});
  return repository.releases;
}

async function getLatestRelease(owner: string, project: string) {
  let hasPrevious = true;
  let before = null;
  while (hasPrevious) {
    const releases = await getReleases(owner, project, before);
    for (let node of releases.nodes.reverse()) {
      if (!node.isPrerelease && !node.isDraft) {
        return node;
      }
    }
    before = releases.pageInfo.startCursor;
    hasPrevious = releases.pageInfo.hasPreviousPage;
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
