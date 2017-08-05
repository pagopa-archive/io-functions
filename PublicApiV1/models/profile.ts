import * as mongoose from "mongoose";

import { IProfile } from "../interfaces/profile";
import { FiscalCode } from "../utils/fiscalcode";

export interface IProfileModel extends IProfile, mongoose.Document { }

export class ProfileModel {
  private profileModel: mongoose.Model<IProfileModel>;

  constructor(profileModel: mongoose.Model<IProfileModel>) {
    this.profileModel = profileModel;
  }

  public getProfileByFiscalCode(fiscalCode: FiscalCode): Promise<this> {
    return this.profileModel.collection.findOne({
      fiscalCode,
    });
  }

}
