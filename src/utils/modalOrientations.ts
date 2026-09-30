/**
 * iOS (30/9): `<Modal>` mặc định chỉ khai hướng DỌC. App khoá NGANG (app.json `orientation`),
 * nên UIKit từ chối trình bày modal - bản dev hiện màn đỏ *"Modal was presented with 0x2
 * orientations mask but the application only supports 0x18"*, bản release thì **SẬP APP**.
 *
 * Mọi `<Modal>` phải truyền `supportedOrientations={MODAL_ORIENTATIONS}`. Android bỏ qua prop này.
 */
export const MODAL_ORIENTATIONS: ('landscape-left' | 'landscape-right')[] = ['landscape-left', 'landscape-right'];
