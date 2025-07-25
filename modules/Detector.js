/**
 * WhatsApp 页面检测器
 * 负责检测WhatsApp页面和初始化状态管理
 */
class WhatsAppDetector {
    constructor() {
        this.isInitialized = false;
        this.isWhatsAppPage = false;
        
        console.log('WhatsAppDetector 初始化');
    }

    /**
     * 检测当前是否为WhatsApp页面
     * @returns {boolean} 是否为WhatsApp页面
     */
    detectWhatsAppPage() {
        const url = window.location.href;
        const isWhatsApp = url.includes('web.whatsapp.com');
        
        console.log('检测WhatsApp页面:', {
            url: url,
            isWhatsApp: isWhatsApp
        });
        
        this.isWhatsAppPage = isWhatsApp;
        return isWhatsApp;
    }

    /**
     * 检测页面是否已完全加载
     * @returns {Promise<boolean>} 页面是否已加载
     */
    async waitForPageLoad() {
        return new Promise((resolve) => {
            if (document.readyState === 'complete') {
                console.log('页面已完全加载');
                resolve(true);
                return;
            }

            console.log('等待页面加载完成...');
            window.addEventListener('load', () => {
                console.log('页面加载完成');
                resolve(true);
            });
        });
    }

    /**
     * 设置初始化状态
     * @param {boolean} status 初始化状态
     */
    setInitializedStatus(status) {
        this.isInitialized = status;
        console.log('设置初始化状态:', status);
    }

    /**
     * 获取初始化状态
     * @returns {boolean} 初始化状态
     */
    getInitializedStatus() {
        return this.isInitialized;
    }

    /**
     * 获取当前页面状态
     * @returns {Object} 页面状态信息
     */
    getPageState() {
        return {
            isInitialized: this.isInitialized,
            isWhatsAppPage: this.isWhatsAppPage,
            url: window.location.href,
            timestamp: Date.now()
        };
    }
}

// 导出到全局作用域
window.WhatsAppDetector = WhatsAppDetector; 