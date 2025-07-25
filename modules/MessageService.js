class MessageService {
    constructor() {
        this.isRunning = false;
        this.observer = null;
        this.messageCache = new Set();
        this.config = {
            retryInterval: 1000,
            scrollThreshold: 100,
            translationDelay: 500
        };
        
        // 消息选择器配置
        this.selectors = {
            // 消息容器选择器
            containers: [
                'div[data-testid="conversation-panel-messages"]',
                '#main div.message-list',
                '.conversation-panel-messages'
            ],
            // 消息元素选择器
            messages: [
                'div.message-in:not([data-processed="true"]), div.message-out:not([data-processed="true"])',
                '[data-testid="msg-container"]:not([data-processed="true"])'
            ],
            // 文本内容选择器
            text: [
                'div.copyable-text span[dir="ltr"]',
                '[data-testid="msg-text"]',
                '.message-text'
            ]
        };
    }

    // 等待WhatsApp页面加载（使用油猴脚本的简洁方式）
    async waitForWhatsApp() {
        return new Promise((resolve) => {
            const checkElement = () => {
                const elements = [
                    document.querySelector('div[role="application"]'),
                    document.querySelector('div[data-testid="conversation-panel-wrapper"]'),
                    document.querySelector('#app')
                ];
                if (elements.some(el => el !== null)) {
                    resolve(true);
                } else {
                    setTimeout(checkElement, this.config.retryInterval);
                }
            };
            checkElement();
        });
    }

    // 获取消息容器
    getMessageContainer() {
        for (const selector of this.selectors.containers) {
            const container = document.querySelector(selector);
            if (container) return container;
        }
        return null;
    }

    // 获取所有未处理的消息
    getAllMessages() {
        const messageSelectors = this.selectors.messages.join(',');
        const messages = document.querySelectorAll(messageSelectors);
        console.log(`MessageService: 找到 ${messages.length} 条未处理消息`);
        return Array.from(messages);
    }

    // 提取消息文本
    extractMessageText(messageElement) {
        for (const selector of this.selectors.text) {
            const textElement = messageElement.querySelector(selector);
            if (textElement) {
                const text = textElement.textContent.trim();
                if (text) return text;
            }
        }
        return null;
    }

    // 标记消息为已处理
    markMessageAsProcessed(messageElement) {
        messageElement.setAttribute('data-processed', 'true');
    }

    // 移除消息处理标记（用于重试）
    unmarkMessageAsProcessed(messageElement) {
        messageElement.removeAttribute('data-processed');
    }

    // 获取消息信息
    getMessageInfo(messageElement) {
        const text = this.extractMessageText(messageElement);
        if (!text) return null;

        return {
            element: messageElement,
            text: text,
            timestamp: Date.now(),
            id: this.generateMessageId(messageElement)
        };
    }

    // 生成消息ID
    generateMessageId(messageElement) {
        const text = this.extractMessageText(messageElement);
        const hash = this.simpleHash(text);
        return `msg_${hash}_${Date.now()}`;
    }

    // 简单哈希函数
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        return Math.abs(hash);
    }

    // 监听DOM变化（新消息）
    startMessageObserver() {
        if (this.observer) {
            this.observer.disconnect();
        }

        this.observer = new MutationObserver((mutations) => {
            let conversationChanged = false;
            
            mutations.forEach((mutation) => {
                // 检查聊天切换
                if (mutation.target.matches && mutation.target.matches([
                    'div[data-testid="conversation-panel-wrapper"]',
                    '#main',
                    '.conversation-panel'
                ].join(','))) {
                    conversationChanged = true;
                }
                
                // 检查新消息
                if (mutation.addedNodes.length) {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1) {
                            const messages = node.querySelectorAll(this.selectors.messages.join(','));
                            messages.forEach(message => {
                                const messageInfo = this.getMessageInfo(message);
                                if (messageInfo) {
                                    this.onNewMessage(messageInfo);
                                }
                            });
                        }
                    });
                }
            });
            
            // 如果检测到聊天切换，立即暂停翻译队列，然后延迟后重新应用翻译
            if (conversationChanged) {
                // 立即暂停翻译队列
                if (this.translationService) {
                    this.translationService.pauseQueue();
                    this.translationService.clearQueue();
                }
                
                setTimeout(() => {
                    this.onConversationChanged();
                }, 1000);
            }
        });

        const appContainer = document.querySelector('#app') || document.body;
        this.observer.observe(appContainer, {
            childList: true,
            subtree: true
        });

        console.log('MessageService: 消息监听器已启动');
    }

    // 监听滚动事件（历史消息）
    startScrollObserver() {
        const container = this.getMessageContainer();
        if (!container) return;

        let timeout;
        container.addEventListener('scroll', () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                this.processAllMessages();
            }, this.config.scrollThreshold);
        });

        console.log('MessageService: 滚动监听器已启动');
    }

    // 处理所有消息
    async processAllMessages() {
        const messages = this.getAllMessages();
        console.log(`MessageService: 开始处理 ${messages.length} 条消息`);

        for (const message of messages) {
            const messageInfo = this.getMessageInfo(message);
            if (messageInfo) {
                this.onNewMessage(messageInfo);
                await new Promise(resolve => setTimeout(resolve, this.config.translationDelay));
            }
        }
    }

    // 新消息回调（由外部设置）
    onNewMessage(messageInfo) {
        console.log('MessageService: 新消息', messageInfo);
        // 这里会由外部设置回调函数
        if (this.messageCallback) {
            this.messageCallback(messageInfo);
        }
    }

    // 设置消息回调
    setMessageCallback(callback) {
        this.messageCallback = callback;
    }

    // 设置聊天切换回调
    setConversationChangeCallback(callback) {
        this.conversationChangeCallback = callback;
    }

    // 聊天切换回调
    onConversationChanged() {
        console.log('MessageService: 检测到聊天切换');
        if (this.conversationChangeCallback) {
            this.conversationChangeCallback();
        }
    }

    // 设置翻译服务引用（用于聊天切换时控制队列）
    setTranslationService(translationService) {
        this.translationService = translationService;
    }

    // 启动服务
    async start() {
        if (this.isRunning) return;

        console.log('MessageService: 等待WhatsApp加载...');
        await this.waitForWhatsApp();
        console.log('MessageService: WhatsApp已加载');

        // 延迟启动确保页面完全加载
        setTimeout(() => {
            this.isRunning = true;
            this.startMessageObserver();
            this.startScrollObserver();
            this.processAllMessages(); // 处理现有消息
            console.log('MessageService: 服务已启动');
        }, 2000);
    }

    // 停止服务
    stop() {
        this.isRunning = false;
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        console.log('MessageService: 服务已停止');
    }

    // 获取服务状态
    getStatus() {
        return {
            isRunning: this.isRunning,
            hasObserver: !!this.observer,
            messageCount: this.getAllMessages().length
        };
    }

    // 清理所有处理标记
    clearAllMarks() {
        const processedMessages = document.querySelectorAll('[data-processed="true"]');
        processedMessages.forEach(msg => {
            msg.removeAttribute('data-processed');
        });
        console.log(`MessageService: 清理了 ${processedMessages.length} 个处理标记`);
    }
}

// 导出到全局作用域
window.MessageService = MessageService; 