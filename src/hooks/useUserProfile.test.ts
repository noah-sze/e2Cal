import { describe, it, expect } from 'vitest';
import type { UserBaseInfo } from '@/types';
import { isBaseInfoComplete } from './useUserProfile';

describe('useUserProfile isSetupCompleted 狀態判定契約', () => {
  it('出廠初始空白態時，isSetupCompleted 應為 false', () => {
    const emptyBase: UserBaseInfo = {
      id: 'primary_user',
      name: '',
      gender: 'male',
      birthDate: '',
      heightCm: 0,
      createdAt: 0,
      updatedAt: 0,
    };
    expect(isBaseInfoComplete(emptyBase)).toBe(false);
  });

  it('僅填寫姓名但無身高或生日時，isSetupCompleted 應為 false', () => {
    const partialBase: Partial<UserBaseInfo> = {
      name: 'Jason',
      heightCm: 0,
      birthDate: '',
    };
    expect(isBaseInfoComplete(partialBase)).toBe(false);
  });

  it('僅填寫身高但無姓名時，isSetupCompleted 應為 false', () => {
    const partialBase: Partial<UserBaseInfo> = {
      name: '',
      heightCm: 175,
      birthDate: '1999-01',
    };
    expect(isBaseInfoComplete(partialBase)).toBe(false);
  });

  it('姓名為純空白字元時，應被視為未填寫 (false)', () => {
    const whitespaceBase: Partial<UserBaseInfo> = {
      name: '   ',
      heightCm: 175,
      birthDate: '1999-01',
    };
    expect(isBaseInfoComplete(whitespaceBase)).toBe(false);
  });

  it('姓名、生日與有效身高 (heightCm > 0) 皆填寫時，isSetupCompleted 應為 true', () => {
    const completeBase: UserBaseInfo = {
      id: 'primary_user',
      name: 'Jason',
      gender: 'male',
      birthDate: '1999-01',
      heightCm: 175,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    expect(isBaseInfoComplete(completeBase)).toBe(true);
  });
});
