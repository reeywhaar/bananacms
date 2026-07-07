import { describe, expect, it } from 'vitest'
import { imageDimensionsFromContent, imageMetadataFromContents } from './getImagesMetadata'

describe('imageDimensionsFromContent', () => {
  it('returns persisted dimensions for plain @1x content', () => {
    expect(imageDimensionsFromContent({ type: 'image', width: 640, height: 480 })).toEqual({
      width: 640,
      height: 480,
    })
  })

  it('divides by the source resolution factor', () => {
    expect(
      imageDimensionsFromContent({ type: 'image', width: 1200, height: 900, resolution: '@2x' }),
    ).toEqual({ width: 600, height: 450 })
    expect(
      imageDimensionsFromContent({ type: 'image', width: 900, height: 300, resolution: '@3x' }),
    ).toEqual({ width: 300, height: 100 })
  })

  it('bounds by maxSize preserving aspect ratio, never upscaling', () => {
    expect(
      imageDimensionsFromContent({
        type: 'image',
        width: 1000,
        height: 500,
        maxSize: { width: 100, height: 100 },
      }),
    ).toEqual({ width: 100, height: 50 })
    expect(
      imageDimensionsFromContent({
        type: 'image',
        width: 50,
        height: 25,
        maxSize: { width: 100, height: 100 },
      }),
    ).toEqual({ width: 50, height: 25 })
  })

  it('never returns dimensions below 1', () => {
    expect(
      imageDimensionsFromContent({ type: 'image', width: 2, height: 1, resolution: '@3x' }),
    ).toEqual({ width: 1, height: 1 })
  })

  it('returns null without persisted dimensions', () => {
    expect(imageDimensionsFromContent(undefined)).toBeNull()
    expect(imageDimensionsFromContent({ type: 'image' })).toBeNull()
    expect(imageDimensionsFromContent({ type: 'image', width: 640 })).toBeNull()
  })
})

describe('imageMetadataFromContents', () => {
  it('maps ids and omits entries without dimensions', () => {
    expect(
      imageMetadataFromContents({
        a: { type: 'image', width: 640, height: 480 },
        b: { type: 'image' },
      }),
    ).toEqual({ a: { width: 640, height: 480 } })
  })
})
