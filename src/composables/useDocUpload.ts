import { ref } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import JSZip from 'jszip'
import { uploadDocument, deleteDocument, type Document } from '@/api/documents'
import { getDocumentContent } from '@/api/chunks'

export function useDocUpload(kbId: string, onDone: () => void) {
  const uploading = ref(false)
  const folderInputRef = ref<HTMLInputElement | null>(null)
  let pendingMdDoc: Document | null = null

  const uploadFiles = async (files: File[]) => {
    uploading.value = true
    try {
      for (const file of files) {
        try {
          const res = await uploadDocument(kbId, file)
          if (res.needs_images) {
            MessagePlugin.warning(`${file.name} 含本地图片引用，可点击“补充图片”上传`)
          } else {
            MessagePlugin.success(`${file.name} 上传成功`)
          }
        } catch {
          MessagePlugin.error(`${file.name} 上传失败`)
        }
      }
    } finally {
      uploading.value = false
      onDone()
    }
  }

  const startImageSupplement = (doc: Document) => {
    pendingMdDoc = doc
    folderInputRef.value?.click()
  }

  const handleFolderSelected = async (e: Event) => {
    const input = e.target as HTMLInputElement
    const folderFiles = input.files
    if (!pendingMdDoc) return

    const mdName = pendingMdDoc.file_name || 'document.md'
    uploading.value = true
    try {
      const { content } = await getDocumentContent(pendingMdDoc.id)

      const zip = new JSZip()
      zip.file(mdName, content)

      if (folderFiles && folderFiles.length > 0) {
        const firstPath = (folderFiles[0] as any).webkitRelativePath as string
        const topFolder = firstPath.split('/')[0]
        for (let i = 0; i < folderFiles.length; i++) {
          const f = folderFiles[i]
          const relPath = (f as any).webkitRelativePath as string
          // 保留顶层文件夹名，md 内引用形如 CUDA.assets/xxx.png
          zip.file(relPath.startsWith(topFolder + '/') ? relPath : `${topFolder}/${relPath}`, f)
        }
      }

      const blob = await zip.generateAsync({ type: 'blob' })
      const zipFile = new File([blob], mdName.replace(/\.(md|markdown)$/i, '.zip'), {
        type: 'application/zip',
      })

      await deleteDocument(pendingMdDoc.id)
      await uploadDocument(kbId, zipFile, mdName)
      MessagePlugin.success(`${mdName} 含图片重新上传成功`)
    } catch {
      MessagePlugin.error('打包上传失败')
    } finally {
      pendingMdDoc = null
      input.value = ''
      uploading.value = false
      onDone()
    }
  }

  return { uploading, folderInputRef, uploadFiles, startImageSupplement, handleFolderSelected }
}
