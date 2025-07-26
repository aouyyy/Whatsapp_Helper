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
        this.selectionMode = null;
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
    async onPageDetected() {
        this.isInitialized = true;
        this.detector.setInitializedStatus(true);
        console.log('WhatsApp Helper 初始化成功');
        
        // 创建UI组件
        this.createFloatingBall();
        this.createMenu();
        this.setupEventListeners();
        
        // 初始化消息和翻译服务
        await this.initServices();
        
        this.showNotification('WhatsApp Helper 已启动');
    }

    /**
     * 初始化消息和翻译服务
     */
    async initServices() {
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
        
        // 初始化选择模式服务
        this.selectionMode = new SelectionMode();
        await this.selectionMode.init();
        
        // 启动服务
        this.messageService.start();
        if (this.translationEnabled) {
            this.translationService.start();
        }
        this.inputTranslator.start();
        
        console.log('消息、翻译、输入翻译和选择模式服务初始化完成');
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
                <div class="menu-item" data-action="toggleSelectionMode">
                    <span class="menu-icon">📋</span>
                    <span>选择模式</span>
                    <span class="menu-status" id="selectionModeStatus">关闭</span>
                </div>
                <div class="menu-submenu" id="selectionSubmenu" style="display: none;">
                    <div class="menu-item submenu-item" data-action="exportSelected">
                        <span class="menu-icon">📤</span>
                        <span>导出选中</span>
                    </div>
                    <div class="menu-item submenu-item" data-action="exportAllContacts">
                        <span class="menu-icon">📦</span>
                        <span>导出全部</span>
                    </div>
                    <div class="menu-item submenu-item" data-action="checkLocalStorage">
                        <span class="menu-icon">🔍</span>
                        <span>查询数据</span>
                    </div>
                    <div class="menu-item submenu-item" data-action="clearAllContacts">
                        <span class="menu-icon">🗑️</span>
                        <span>清空数据</span>
                    </div>
                    <div class="menu-item submenu-item" data-action="testImageDownload">
                        <span class="menu-icon">🧪</span>
                        <span>测试图片下载</span>
                    </div>
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
        this.updateSelectionModeStatus(); // 更新选择模式状态显示
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
            toggleInputTranslation: () => this.toggleInputTranslation(),
            toggleSelectionMode: () => this.toggleSelectionMode(),
            exportSelected: () => this.exportSelected(),
            exportAllContacts: () => this.exportAllContacts(),
            checkLocalStorage: () => this.checkLocalStorage(),
            clearAllContacts: () => this.clearAllContacts(),
            testImageDownload: () => this.testImageDownload()
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
     * 切换选择模式
     */
    async toggleSelectionMode() {
        if (!this.selectionMode) {
            this.showNotification('选择模式服务未初始化');
            return;
        }

        const isEnabled = await this.selectionMode.toggleSelectMode();
        
        if (isEnabled) {
            this.showNotification('选择模式已开启');
            // 显示二级菜单
            this.showSelectionSubmenu();
        } else {
            this.showNotification('选择模式已关闭');
            // 隐藏二级菜单
            this.hideSelectionSubmenu();
        }
        
        this.updateSelectionModeStatus();
    }

    /**
     * 更新选择模式状态显示
     */
    updateSelectionModeStatus() {
        const statusElement = this.menu.querySelector('#selectionModeStatus');
        if (statusElement && this.selectionMode) {
            const isEnabled = this.selectionMode.selectMode;
            statusElement.textContent = isEnabled ? '开启' : '关闭';
            statusElement.style.color = isEnabled ? '#00a884' : '#999';
            statusElement.style.borderColor = isEnabled ? '#00a884' : '#999';
        }
    }

    /**
     * 显示选择模式二级菜单
     */
    showSelectionSubmenu() {
        const submenu = this.menu.querySelector('#selectionSubmenu');
        if (submenu) {
            submenu.style.display = 'block';
        }
    }

    /**
     * 隐藏选择模式二级菜单
     */
    hideSelectionSubmenu() {
        const submenu = this.menu.querySelector('#selectionSubmenu');
        if (submenu) {
            submenu.style.display = 'none';
        }
    }

    /**
     * 导出选中消息
     */
    exportSelected() {
        if (!this.selectionMode) {
            this.showNotification('选择模式服务未初始化');
            return;
        }
        this.selectionMode.exportSelected();
    }

    /**
     * 导出所有联系人消息
     */
    async exportAllContacts() {
        if (!this.selectionMode) {
            this.showNotification('选择模式服务未初始化');
            return;
        }
        await this.selectionMode.exportAllContacts();
    }

    /**
     * 查询本地存储数据
     */
    async checkLocalStorage() {
        if (!this.selectionMode) {
            this.showNotification('选择模式服务未初始化');
            return;
        }
        await this.selectionMode.checkLocalStorage();
    }

    /**
     * 清空所有联系人消息
     */
    async clearAllContacts() {
        if (!this.selectionMode) {
            this.showNotification('选择模式服务未初始化');
            return;
        }
        await this.selectionMode.clearAllContacts();
    }

    /**
     * 测试图片下载功能
     */
    async testImageDownload() {
        if (!this.selectionMode) {
            this.showNotification('选择模式服务未初始化');
            return;
        }
        await this.selectionMode.testImageDownload();
    }

    /**
     * 显示状态
     */
    showStatus() {
        const pageState = this.detector.getPageState();
        const inputTranslationStatus = this.inputTranslator ? this.inputTranslator.getStatus() : null;
        const selectionModeStatus = this.selectionMode ? this.selectionMode.getStatus() : null;
        
        const status = {
            initialized: this.isInitialized,
            translationEnabled: this.translationEnabled,
            inputTranslationEnabled: inputTranslationStatus?.isEnabled,
            selectionModeEnabled: selectionModeStatus?.selectMode,
            pageState: pageState,
            timestamp: new Date().toLocaleString()
        };
        
        console.log('插件状态:', status);
        
        let statusText = `消息翻译: ${this.translationEnabled ? '开启' : '关闭'}`;
        if (inputTranslationStatus) {
            statusText += `, 输入翻译: ${inputTranslationStatus.isEnabled ? '开启' : '关闭'}`;
        }
        if (selectionModeStatus) {
            statusText += `, 选择模式: ${selectionModeStatus.selectMode ? '开启' : '关闭'}`;
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
        console.log('选择模式状态:', this.selectionMode?.getStatus());
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