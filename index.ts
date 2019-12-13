import * as dotenv from 'dotenv';
import { graphql } from '@octokit/graphql';

async function getReleases(owner: string, project: string, after: string, num: number = 10) {
  const { repository } = await graphql(`query releases($owner: String!, $project: String!, $after: String, $num: Int!)
{
  repository(owner: $owner, name: $project) {
    releases(after: $after, first: $num, orderBy: { direction: DESC, field: CREATED_AT }) {
      nodes {
        isPrerelease
        isDraft
        tagName
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
}`, {
  owner,
  project,
  num,
  after,
  headers: {
    authorization: `token ${process.env.GITHUB_TOKEN}`
  }
});
  return repository.releases;
}

async function getLatestRelease(owner: string, project: string) {
  let hasNext = true;
  let after = null;
  while (hasNext) {
    const releases = await getReleases(owner, project, after, 5);
    for (let node of releases.nodes) {
      if (!node.isPrerelease && !node.isDraft) {
        return node;
      }
    }
    after = releases.pageInfo.endCursor;
    hasNext = releases.pageInfo.hasNextPage;
  }
  return null;
}

async function getTags(owner: string, project: string, after: string, num: number = 10) {
  const { repository } = await graphql(`query tags($owner: String!, $project: String!, $after: String, $num: Int!)
{
  repository(owner: $owner, name: $project) {
    refs(first: $num, after: $after, refPrefix: "refs/tags/", orderBy: { direction: DESC, field: TAG_COMMIT_DATE }) {
      nodes {
        name
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
}`, {
  owner,
  project,
  after,
  num,
  headers: {
    authorization: `token ${process.env.GITHUB_TOKEN}`
  }
});
  return repository.refs;
}

async function getMatchedTag(owner: string, project: string) {
  let hasNext = true;
  let after = null;
  while (hasNext) {
    const refs = await getTags(owner, project, after);
    for (let node of refs.nodes) {
      if (/^v?[0-9.]+$/.test(node.name)) {
        return node;
      }
    }
    after = refs.pageInfo.endCursor;
    hasNext = refs.pageInfo.hasNextPage;
  }
  return null;
}


async function main() {
  for (let i = 2; i < process.argv.length; i++) {
    let repo = process.argv[i];
    const tag = /tag:(.*)/.exec(repo);
    if (tag) {
      repo = tag[1];
    }
    const [owner, project] = repo.split('/');
    if (tag) {
      const tag = await getMatchedTag(owner, project);
      if (tag) {
        console.log(`${repo}: ${tag.name}`);
      } else {
        console.log(`${repo}: No tag found!`);
      }
    } else {
      const release = await getLatestRelease(owner, project);
      if (release) {
        console.log(`${repo}: ${release.tagName}`);
      } else {
        console.log(`${repo}: No release found!`);
      }
    }
  }
}

dotenv.config();
main();
