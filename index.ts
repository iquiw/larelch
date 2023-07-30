import * as dotenv from 'dotenv';
import { graphql } from '@octokit/graphql';

async function getReleases(owner: string, project: string, after: string, order: boolean = true, num: number = 10) {
  let orderCondition = '';
  if (order) {
    orderCondition = ', orderBy: { direction: DESC, field: CREATED_AT }';
  }
  const { repository } = await graphql<any>(`query releases($owner: String!, $project: String!, $after: String, $num: Int!)
{
  repository(owner: $owner, name: $project) {
    releases(after: $after, first: $num ${orderCondition}) {
      nodes {
        isPrerelease
        isDraft
        tagCommit {
          oid
        }
        tagName
        createdAt
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

async function getLatestRelease(owner: string, project: string, order: boolean) {
  let hasNext = true;
  let after = null;
  while (hasNext) {
    const releases = await getReleases(owner, project, after, order, 5);
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

async function getTags(owner: string, project: string, after: string, order: boolean = true, num: number = 10) {
  let orderCondition = '';
  if (order) {
    orderCondition = ', orderBy: { direction: DESC, field: TAG_COMMIT_DATE }';
  }
  const { repository } = await graphql<any>(`query tags($owner: String!, $project: String!, $after: String, $num: Int!)
{
  repository(owner: $owner, name: $project) {
    refs(first: $num, after: $after, refPrefix: "refs/tags/"${orderCondition}) {
      nodes {
        name
        target {
          oid
        }
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

async function getMatchedTag(owner: string, project: string, order: boolean) {
  let hasNext = true;
  let after = null;
  while (hasNext) {
    const refs = await getTags(owner, project, after, order);
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

function abbrev(oid: string, num: number = 0): string {
  if (num == 0) {
    return oid;
  } else {
    return oid.substring(0, num);
  }
}

async function main() {
  for (let i = 2; i < process.argv.length; i++) {
    let repo = process.argv[i];
    let order = true;
    const tag = /tag:(.*)/.exec(repo);
    if (tag) {
      repo = tag[1];
    }
    const noorder = /(.*):noorder/.exec(repo);
    if (noorder) {
      order = false;
      repo = noorder[1];
    }
    const [owner, project] = repo.split('/');
    if (tag) {
      const tag = await getMatchedTag(owner, project, order);
      if (tag) {
        console.log(`${repo}: ${tag.name} ${abbrev(tag.target.oid)}`);
      } else {
        console.log(`${repo}: No tag found!`);
      }
    } else {
      const release = await getLatestRelease(owner, project, order);
      if (release) {
        console.log(`${repo}: ${release.tagName} ${abbrev(release.tagCommit.oid)}`);
      } else {
        console.log(`${repo}: No release found!`);
      }
    }
  }
}

dotenv.config();
main();
