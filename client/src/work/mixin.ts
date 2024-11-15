import { getRedirectedLocation, getSeasonInfo, getVideoInfo } from './data'
import { WorkRoute } from '.'
import van from 'vanjs-core'
import { Episode, PageInParseResult } from './type'

/** 点击按钮开始解析 */
export const start = async (
    workRoute: WorkRoute,
    option: {
        /** 标识字段类型 */
        idType: IDType
        /** 标识字段值 */
        value: string | number
        /** 调用来源 */
        from: 'click' | 'onfirst'
    }) => {
    // 如果初始载入路由时，路由参数不带有视频信息，则会随机选择一个热门视频
    // 这种情况展示的解析结果，不应该同步修改路由参数，用户直接刷新网页，可以继续随机推荐不同的视频
    // 而如果是单击按钮或者路由参数带有视频信息，那么实现的解析结果需要同步修改路由参数
    if (!workRoute.isInitPopular.val)
        history.replaceState(null, '', `#/work/${option.idType}/${option.value}`)
    workRoute.btnLoading.val = true
    workRoute.sectionTabsActiveIndex.val = 0
    if (option.idType === 'bv') {
        const bvid = option.value as string
        await getVideoInfo(bvid).then(info => {
            workRoute.videoInfocardData.val = {
                section: (info.ugc_season.sections || []).map(i => {
                    let index = 0
                    return {
                        title: (info.ugc_season.sections || []).length == 1 ? info.ugc_season.title : i.title,
                        pages: i.episodes.flatMap(j => j.pages.map(k => {
                            index++
                            return {
                                bvid: j.bvid,
                                cid: k.cid,
                                dimension: k.dimension,
                                duration: k.duration,
                                page: index,
                                part: j.title,
                                bandge: index.toString(),
                                selected: van.state(bvid == j.bvid)
                            }
                        }))
                    }
                }),
                targetURL: `https://www.bilibili.com/video/${bvid}`,
                areas: [],
                styles: [],
                status: '',
                cover: info.pic,
                title: info.title,
                description: info.desc,
                publishData: new Date(info.pubdate * 1000).toLocaleString(),
                duration: info.duration,
                pages: info.pages.map((page, index) => ({
                    ...page,
                    bvid,
                    bandge: (index + 1).toString(),
                    selected: van.state(info.pages.length == 1)
                })),
                dimension: info.dimension,
                owner: info.owner,
                staff: info.staff?.map(i => `${i.name}[${i.title}]`) || []
            }
            workRoute.videoInfoCardMode.val = 'video'
        })
    } else if (option.idType === 'ep' || option.idType === 'ss') {
        const epid = option.idType === 'ep' ? option.value as number : 0
        const ssid = option.idType === 'ss' ? option.value as number : 0
        await getSeasonInfo(epid, ssid).then(info => {
            workRoute.videoInfocardData.val = {
                section: (info.section || []).map(i => ({
                    pages: i.episodes.map(episodeToPage),
                    title: i.title
                })),
                targetURL: `https://www.bilibili.com/bangumi/play/${option.idType}${option.value}`,
                areas: info.areas.map(i => i.name),
                styles: info.styles,
                duration: 0,
                cover: info.cover,
                description: info.evaluate,
                owner: { name: info.actors, face: '', mid: 0 },
                pages: info.episodes.map(episodeToPage),
                status: info.new_ep.desc,
                publishData: new Date().toLocaleDateString(),
                staff: info.actors.split('\n'),
                dimension: { height: 0, rotate: 0, width: 0 },
                title: info.title
            }
            workRoute.videoInfoCardMode.val = 'season'
        })
    }
}

const episodeToPage = (episode: Episode, index: number): PageInParseResult => {
    return {
        bvid: episode.bvid,
        cid: episode.cid,
        dimension: episode.dimension,
        duration: episode.duration,
        page: index + 1,
        part: episode.long_title || (episode.title.match(/^\d+$/) ? `第 ${episode.title} 集` : episode.title),
        bandge: episode.title,
        selected: van.state(false)
    }
}

export type IDType = 'bv' | 'ep' | 'ss'

/**
 * 校验用户输入的待解析的视频链接
 * @param url 待解析的视频链接
 * @returns 如果校验成功，则返回 BV 号，否则返回 `false`
 */
export const checkURL = (url: string): {
    type: IDType
    value: string | number
} => {
    const matchBvid = url.match(/^(?:https?:\/\/www\.bilibili\.com\/video\/)?(BV1[a-zA-Z0-9]+)/)
    if (matchBvid) return { type: 'bv', value: matchBvid[1] }

    const matchSeason = url.match(/^(?:https?:\/\/www\.bilibili\.com\/bangumi\/play\/)?(ep|ss)(\d+)/)
    if (matchSeason) return { type: matchSeason[1] as 'ep' | 'ss', value: parseInt(matchSeason[2]) }

    throw new Error('您输入的视频链接格式错误')
}

/** 将秒数转换为 `mm:ss` */
export const secondToTime = (second: number) => {
    return `${Math.floor(second / 60)}:${(second % 60).toString().padStart(2, '0')}`
}

/** 如果是 B23 地址，则返回重定向后的地址，否则返回 `false` */
export const handleB23 = async (url: string): Promise<string | false> => {
    if (!url.match(/^https:\/\/b23.tv\//)) return false
    const epMatch = url.match(/^https:\/\/b23.tv\/(ep|ss)(\d+)/)
    if (epMatch) return `https://www.bilibili.com/bangumi/play/${epMatch[1]}${epMatch[2]}`
    try {
        const location = await getRedirectedLocation(url)
        return location
    } catch (error) {
        if (error instanceof Error && error.message != 'Failed to fetch') {
            return false
        }
        throw error
    }
}