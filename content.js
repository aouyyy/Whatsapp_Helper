/**
 * WhatsApp Helper 插件主控制器
 */
class WhatsAppHelper {
    constructor() {
        this.isInitialized = false;
        this.detector = null;
        this.floatingBall = null;
        this.menu = null;
        this.isMenuVisible = false;
        this.messageService = null;
        this.translationService = null;
        this.inputTranslator = null;
        this.translationEnabled = true; // 翻译功能开关状态
    }

    /**
     * 初始化插件
     */
    async init() {
        if (this.isInitialized) {
            console.log('插件已初始化');
            return;
        }

        console.log('初始化 WhatsApp Helper 插件...');

        // 初始化检测器
        this.detector = new WhatsAppDetector();
        
        // 等待页面加载完成
        await this.detector.waitForPageLoad();
        
        // 检测是否为WhatsApp页面
        if (this.detector.detectWhatsAppPage()) {
            console.log('检测到WhatsApp页面，开始初始化...');
            this.onPageDetected();
        } else {
            console.log('未检测到WhatsApp页面，等待页面变化...');
            this.waitForWhatsAppPage();
        }
    }

    /**
     * 页面检测成功回调
     */
    onPageDetected() {
        this.isInitialized = true;
        this.detector.setInitializedStatus(true);
        console.log('WhatsApp Helper 初始化成功');
        
        // 创建UI组件
        this.createFloatingBall();
        this.createMenu();
        this.setupEventListeners();
        
        // 初始化消息和翻译服务
        this.initServices();
        
        this.showNotification('WhatsApp Helper 已启动');
    }

    /**
     * 初始化消息和翻译服务
     */
    initServices() {
        console.log('初始化消息和翻译服务...');
        
        // 初始化消息服务
        this.messageService = new MessageService();
        this.messageService.setMessageCallback((messageInfo) => {
            // 当有新消息时，根据翻译开关状态决定是否翻译
            if (this.translationEnabled && this.translationService && this.translationService.isRunning) {
                this.translationService.handleNewMessage(messageInfo);
            }
        });
        
        // 初始化翻译服务
        this.translationService = new TranslationService();
        
        // 设置翻译服务引用到消息服务
        this.messageService.setTranslationService(this.translationService);
        
        // 设置聊天切换回调
        this.messageService.setConversationChangeCallback(() => {
            // 当聊天切换时，重新应用翻译并恢复队列处理
            if (this.translationEnabled && this.translationService && this.translationService.isRunning) {
                setTimeout(() => {
                    this.translationService.reapplyAllTranslations();
                    this.translationService.resumeQueue(); // 恢复队列处理
                }, 500);
            }
        });
        
        // 初始化输入翻译服务
        this.inputTranslator = new InputTranslator();
        
        // 启动服务
        this.messageService.start();
        if (this.translationEnabled) {
            this.translationService.start();
        }
        this.inputTranslator.start();
        
        console.log('消息、翻译和输入翻译服务初始化完成');
    }

    /**
     * 等待WhatsApp页面
     */
    waitForWhatsAppPage() {
        console.log('等待WhatsApp页面...');
        
        // 监听URL变化
        let currentUrl = window.location.href;
        const checkUrl = () => {
            if (window.location.href !== currentUrl) {
                currentUrl = window.location.href;
                if (this.detector.detectWhatsAppPage()) {
                    console.log('检测到WhatsApp页面，开始初始化...');
                    this.onPageDetected();
                    return;
                }
            }
            setTimeout(checkUrl, 1000);
        };
        
        checkUrl();
    }

    /**
     * 创建悬浮球
     */
    createFloatingBall() {
        this.floatingBall = document.createElement('div');
        this.floatingBall.className = 'whatsapp-helper-floating-ball';
        this.floatingBall.innerHTML = `
            <div class="ball-icon">💬</div>
            <div class="ball-status">ON</div>
        `;
        
        document.body.appendChild(this.floatingBall);
        console.log('悬浮球已创建');
    }

    /**
     * 创建菜单
     */
    createMenu() {
        this.menu = document.createElement('div');
        this.menu.className = 'whatsapp-helper-menu';
        this.menu.style.display = 'none';
        
        this.menu.innerHTML = `
            <div class="menu-header">
                <span>WhatsApp Helper</span>
                <button class="close-btn">×</button>
            </div>
            <div class="menu-content">
                <div class="menu-item" data-action="toggleTranslation">
                    <span class="menu-icon">🔄</span>
                    <span>消息翻译</span>
                    <span class="menu-status" id="translationStatus">开启</span>
                </div>
                <div class="menu-item" data-action="toggleInputTranslation">
                    <span class="menu-icon">⌨️</span>
                    <span>输入翻译</span>
                    <span class="menu-status" id="inputTranslationStatus">开启</span>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.menu);
        console.log('菜单已创建');
    }

    /**
     * 设置事件监听
     */
    setupEventListeners() {
        // 悬浮球点击事件
        this.floatingBall.addEventListener('click', () => {
            this.toggleMenu();
        });

        // 菜单关闭按钮事件
        const closeBtn = this.menu.querySelector('.close-btn');
        closeBtn.addEventListener('click', () => {
            this.hideMenu();
        });

        // 菜单项点击事件
        this.menu.addEventListener('click', (e) => {
            const menuItem = e.target.closest('.menu-item');
            if (menuItem) {
                const action = menuItem.getAttribute('data-action');
                this.handleMenuAction(action);
            }
        });

        // 点击外部关闭菜单
        document.addEventListener('click', (e) => {
            if (!this.floatingBall.contains(e.target) && !this.menu.contains(e.target)) {
                this.hideMenu();
            }
        });

        console.log('事件监听器已设置');
    }

    /**
     * 切换菜单显示状态
     */
    toggleMenu() {
        if (this.isMenuVisible) {
            this.hideMenu();
        } else {
            this.showMenu();
        }
    }

    /**
     * 显示菜单
     */
    showMenu() {
        this.menu.style.display = 'block';
        this.isMenuVisible = true;
        this.updateTranslationStatus(); // 更新翻译状态显示
        this.updateInputTranslationStatus(); // 更新输入翻译状态显示
        console.log('菜单已显示');
    }

    /**
     * 隐藏菜单
     */
    hideMenu() {
        this.menu.style.display = 'none';
        this.isMenuVisible = false;
        console.log('菜单已隐藏');
    }

    /**
     * 处理菜单动作
     */
    handleMenuAction(action) {
        console.log(`执行菜单动作: ${action}`);
        
        const actions = {
            toggleTranslation: () => this.toggleTranslation(),
            toggleInputTranslation: () => this.toggleInputTranslation()
        };

        if (actions[action]) {
            actions[action]();
        } else {
            console.log(`未知动作: ${action}`);
        }
    }

    /**
     * 切换翻译功能
     */
    toggleTranslation() {
        this.translationEnabled = !this.translationEnabled;
        
        if (this.translationEnabled) {
            // 开启翻译功能
            if (this.translationService) {
                this.translationService.start();
                // 重新应用所有已翻译的消息
                setTimeout(() => {
                    this.translationService.reapplyAllTranslations();
                }, 500);
            }
            this.showNotification('翻译功能已开启');
        } else {
            // 关闭翻译功能
            if (this.translationService) {
                this.translationService.stop();
                this.translationService.clearAllTranslations();
            }
            this.showNotification('翻译功能已关闭');
        }
        
        // 更新菜单显示
        this.updateTranslationStatus();
    }

    /**
     * 更新翻译状态显示
     */
    updateTranslationStatus() {
        const statusElement = this.menu.querySelector('#translationStatus');
        if (statusElement) {
            statusElement.textContent = this.translationEnabled ? '开启' : '关闭';
            statusElement.style.color = this.translationEnabled ? '#00a884' : '#999';
            statusElement.style.borderColor = this.translationEnabled ? '#00a884' : '#999';
        }
    }

    /**
     * 切换输入翻译功能
     */
    toggleInputTranslation() {
        if (this.inputTranslator) {
            this.inputTranslator.toggleEnabled();
            this.updateInputTranslationStatus();
            this.showNotification(`输入翻译功能已${this.inputTranslator.isEnabled ? '开启' : '关闭'}`);
        } else {
            this.showNotification('输入翻译服务未初始化');
        }
    }

    /**
     * 更新输入翻译状态显示
     */
    updateInputTranslationStatus() {
        const statusElement = this.menu.querySelector('#inputTranslationStatus');
        if (statusElement && this.inputTranslator) {
            statusElement.textContent = this.inputTranslator.isEnabled ? '开启' : '关闭';
            statusElement.style.color = this.inputTranslator.isEnabled ? '#00a884' : '#999';
            statusElement.style.borderColor = this.inputTranslator.isEnabled ? '#00a884' : '#999';
        }
    }

    /**
     * 显示状态
     */
    showStatus() {
        const pageState = this.detector.getPageState();
        const inputTranslationStatus = this.inputTranslator ? this.inputTranslator.getStatus() : null;
        
        const status = {
            initialized: this.isInitialized,
            translationEnabled: this.translationEnabled,
            inputTranslationEnabled: inputTranslationStatus?.isEnabled,
            pageState: pageState,
            timestamp: new Date().toLocaleString()
        };
        
        console.log('插件状态:', status);
        
        let statusText = `消息翻译: ${this.translationEnabled ? '开启' : '关闭'}`;
        if (inputTranslationStatus) {
            statusText += `, 输入翻译: ${inputTranslationStatus.isEnabled ? '开启' : '关闭'}`;
        }
        
        this.showNotification(statusText);
    }

    /**
     * 调试信息
     */
    debugInfo() {
        console.log('=== 调试信息 ===');
        console.log('插件实例:', this);
        console.log('消息翻译状态:', this.translationEnabled);
        console.log('输入翻译状态:', this.inputTranslator?.getStatus());
        console.log('页面状态:', this.detector.getPageState());
        console.log('页面URL:', window.location.href);
        
        this.showNotification('调试信息已输出到控制台');
    }

    /**
     * 清空控制台
     */
    clearConsole() {
        console.clear();
        this.showNotification('控制台已清空');
    }

    /**
     * 显示通知
     */
    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'whatsapp-helper-notification';
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // 自动移除通知
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// 等待页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const helper = new WhatsAppHelper();
        helper.init();
    });
} else {
    const helper = new WhatsAppHelper();
    helper.init();
} 