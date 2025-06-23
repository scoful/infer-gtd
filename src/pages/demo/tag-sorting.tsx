import { type NextPage } from "next";
import Head from "next/head";
import { useState } from "react";
import MainLayout from "@/components/Layout/MainLayout";
import AuthGuard from "@/components/Layout/AuthGuard";
import { TagSelector } from "@/components/Tags";

const TagSortingDemo: NextPage = () => {
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [sortableEnabled, setSortableEnabled] = useState(true);

  return (
    <>
      <Head>
        <title>标签拖拽排序演示 | Infer GTD</title>
        <meta name="description" content="标签拖拽排序功能演示" />
      </Head>

      <AuthGuard>
        <MainLayout>
          <div className="container mx-auto px-4 py-8">
            <div className="max-w-4xl mx-auto">
              <h1 className="text-3xl font-bold text-gray-900 mb-8">
                标签拖拽排序演示
              </h1>

              <div className="space-y-8">
                {/* 功能说明 */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <h2 className="text-lg font-medium text-blue-900 mb-4">功能说明</h2>
                  <div className="text-sm text-blue-800 space-y-2">
                    <p>• 启用拖拽排序后，可以通过拖拽已选中的标签来调整它们的顺序</p>
                    <p>• 拖拽时标签会变为半透明状态，释放后完成排序</p>
                    <p>• 支持键盘操作：使用 Tab 键选择标签，空格键开始拖拽，方向键移动位置</p>
                    <p>• 拖拽功能可以通过 sortable 属性控制开启或关闭</p>
                  </div>
                </div>

                {/* 控制选项 */}
                <div className="bg-white p-6 rounded-lg shadow">
                  <h2 className="text-lg font-medium text-gray-900 mb-4">控制选项</h2>
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={sortableEnabled}
                        onChange={(e) => setSortableEnabled(e.target.checked)}
                        className="mr-2"
                      />
                      启用拖拽排序
                    </label>
                  </div>
                </div>

                {/* 标签选择器演示 */}
                <div className="bg-white p-6 rounded-lg shadow">
                  <h2 className="text-lg font-medium text-gray-900 mb-4">标签选择器</h2>
                  <div className="space-y-4">
                    <TagSelector
                      selectedTagIds={selectedTagIds}
                      onTagsChange={setSelectedTagIds}
                      placeholder="选择标签并尝试拖拽排序..."
                      sortable={sortableEnabled}
                      allowCreate={true}
                      maxTags={10}
                    />
                    
                    {/* 显示当前选择的标签顺序 */}
                    {selectedTagIds.length > 0 && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-md">
                        <h3 className="text-sm font-medium text-gray-700 mb-2">
                          当前标签顺序 (共 {selectedTagIds.length} 个):
                        </h3>
                        <div className="text-sm text-gray-600 space-y-1">
                          {selectedTagIds.map((tagId, index) => (
                            <div key={tagId} className="flex items-center">
                              <span className="w-6 text-right mr-2">{index + 1}.</span>
                              <span className="font-mono text-xs bg-gray-200 px-2 py-1 rounded">
                                {tagId}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 使用说明 */}
                <div className="bg-white p-6 rounded-lg shadow">
                  <h2 className="text-lg font-medium text-gray-900 mb-4">使用说明</h2>
                  <div className="prose text-sm text-gray-600">
                    <h3 className="text-base font-medium text-gray-900 mb-2">如何使用拖拽排序：</h3>
                    <ol className="list-decimal list-inside space-y-2">
                      <li>首先选择一些标签</li>
                      <li>确保"启用拖拽排序"选项已勾选</li>
                      <li>在已选中的标签区域，按住鼠标左键拖拽标签</li>
                      <li>拖拽到目标位置后释放鼠标</li>
                      <li>标签顺序会立即更新</li>
                    </ol>
                    
                    <h3 className="text-base font-medium text-gray-900 mb-2 mt-4">键盘操作：</h3>
                    <ul className="list-disc list-inside space-y-1">
                      <li><kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">Tab</kbd> - 在标签间切换焦点</li>
                      <li><kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">Space</kbd> - 开始/结束拖拽</li>
                      <li><kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">←→</kbd> - 在拖拽模式下移动标签位置</li>
                    </ul>
                  </div>
                </div>

                {/* 技术实现 */}
                <div className="bg-white p-6 rounded-lg shadow">
                  <h2 className="text-lg font-medium text-gray-900 mb-4">技术实现</h2>
                  <div className="text-sm text-gray-600 space-y-2">
                    <p><strong>拖拽库：</strong> @dnd-kit (React 拖拽库)</p>
                    <p><strong>排序策略：</strong> horizontalListSortingStrategy (水平列表排序)</p>
                    <p><strong>碰撞检测：</strong> closestCenter (最近中心点检测)</p>
                    <p><strong>激活距离：</strong> 8px (避免误触)</p>
                    <p><strong>视觉反馈：</strong> 拖拽时透明度变为 50%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </MainLayout>
      </AuthGuard>
    </>
  );
};

export default TagSortingDemo;
