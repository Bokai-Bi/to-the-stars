import { Octokit } from 'octokit'
import { fs, path, glob } from 'zx'
import { chain } from 'lodash-es'

const commentPath = path.resolve(__dirname, 'comment.json')

// 获取所有的现有评论并缓存
async function fetchComments(commentPath: string) {
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  })
  const query = `
    query {
      repository(owner: "liuli-moe", name: "to-the-stars") {
        discussions(first: 100) {
          nodes {
            id
            title
            bodyText
          }
        }
      }
    }
  `

  await fs.writeJson(commentPath, await octokit.graphql(query), { spaces: 2 })
}

// await fetchComments(commentPath)
// 获取本地的文件，计算旧的评论和新的评论，生成映射表
async function calcMaps() {
  const list = await glob('**/*.md', { cwd: path.resolve(__dirname, '../books') })
  return chain(list)
    .map((it) => {
      const p = it.slice(0, it.length - 3)
      const origin = 'books/' + p.replace('readme', '').replace(/\/\d{3}\-/, '/')
      let newPath = p.includes('readme') ? p.replace('readme', '') : p + '.html'
      return { origin, newPath }
    })
    .map((it) => ({
      origin: encodeURI(it.origin),
      newPath: encodeURI(it.newPath),
    }))
    .keyBy('origin')
    .value()
}
// const maps = await calcMaps()

// 批量更新 github 评论
async function batchUpdateComments(maps: Record<string, { origin: string; newPath: string }>) {
  const comments = (await fs.readJson(commentPath)).repository.discussions.nodes as {
    id: string
    title: string
    bodyText: string
  }[]
  // console.log(Object.keys(maps).find((it) => it.includes('%E7%AC%AC%E4%B8%80%E7%AB%A0-%E8%AE%B8%E6%84%BF')))
  comments.forEach((it) => {
    const m = maps[it.title]
    if (!m) {
      throw new Error(`找不到对应的映射 ${it.title}`)
    }
    it.title = m.newPath
    it.bodyText = it.bodyText.replaceAll(m.origin, m.newPath)
  })
  console.log(comments.slice(0, 1))
  for (const comment of comments) {
    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    })
    const query = `
      mutation {
        updateDiscussion(input: {discussionId: "${comment.id}", title: "${comment.title}", body: "${comment.bodyText}"}) {
          clientMutationId
        }
      }
    `
    await octokit.graphql(query)
  }
}

const comments = (await fs.readJson(commentPath)).repository.discussions.nodes as {
  id: string
  title: string
  bodyText: string
}[]
for (const comment of comments) {
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  })
  const query = `
    mutation {
      updateDiscussion(input: {discussionId: "${comment.id}", title: "${
    comment.title
  }", body: "${comment.bodyText.replaceAll('.html.html', '.html')}"}) {
        clientMutationId
      }
    }
  `
  await octokit.graphql(query)
}
