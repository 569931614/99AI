export const copyRight = {
  wex: '',
  qnum: 'MjAyNQ==',
  website: '',
  /* 下三个是个人的 上面是公开的 */
  // wex: '',
  // qnum: '',
  // website: '',
  name: 'QUlXZWIgUm9sZVBsYXk=',
};

export function atob(str: string) {
  if (!str) {
    return '';
  }
  return decodeURIComponent(escape(window.atob(str)));
}
